#!/bin/bash

# Exit immediately if a command exits with a non-zero status
set -e

# --- Configuration Mapping ---
# Format: "source_dir|relative_destination"
# Use "." to indicate the root of the deployment folder
declare -A APPS
APPS["parts"]="/home/wchrestay/web_apps/parts|parts"
APPS["portal"]="/home/wchrestay/web_apps/portal|." 
APPS["projects"]="/home/wchrestay/web_apps/projects|projects"
APPS["work_orders"]="/home/wchrestay/web_apps/work_orders|work_orders"

# --- SHARED RESOURCES ---
declare -A SHARED_RESOURCES
SHARED_RESOURCES["misc"]="/home/wchrestay/web_apps/misc|misc"
SHARED_RESOURCES["api"]="/home/wchrestay/web_apps/api|api"

# --- INDEX FILES ---
INDEX_SOURCE_DIR="/home/wchrestay/web_apps"
FILE_PUBLIC_PHP="public_index.php"
FILE_WWW_PHP="www_index.php"

# --- 1. Argument & Environment Parsing ---
DEPLOY_ROOT="/opt/apache/www/public"
SERVER_ROOT="/opt/apache/www"
MODE_NAME="PRODUCTION"

# --- ENVIRONMENT VARIABLES ---
# 1. Base URL for the app router
WEB_BASE_URL="/public/"

# 2. PocketBase URL (Default Production URL)
PB_URL="https://wchrestay-ubuntu.lan.local.cmu.edu/pocketbase"

FILTERED_ARGS=()

# Separate flags from app names
for arg in "$@"; do
    if [[ "$arg" == "-t" ]]; then
        DEPLOY_ROOT="/opt/apache/www/testing"
        MODE_NAME="TESTING"
        
        # Testing Configuration
        WEB_BASE_URL="/testing/"
        # PocketBase URL for Testing (Same as Prod in this case)
        PB_URL="https://wchrestay-ubuntu.lan.local.cmu.edu/pocketbase"
        
    elif [[ "$arg" == "--list-completions" ]]; then
        echo "${!APPS[@]}"
        exit 0
    else
        FILTERED_ARGS+=("$arg")
    fi
done

# Reset positional arguments to only contain app names
set -- "${FILTERED_ARGS[@]}"

echo "======================================================="
echo "🚀 BUILD & DEPLOY SCRIPT"
echo "🎯 Target Environment: $MODE_NAME"
echo "📂 Apps Deploy To:     $DEPLOY_ROOT"
echo "🔗 Web Base URL:       $WEB_BASE_URL"
echo "🗄️  PocketBase URL:     $PB_URL"
echo "======================================================="

USER_GROUP="root:opt-admins"
TARGETS=()
FAILURES=()
IS_BATCH_MODE=false

# --- 2. Determine Targets ---
if [ $# -gt 0 ]; then
    # MANUAL MODE
    IS_BATCH_MODE=false
    for arg in "$@"; do
        if [ -n "${APPS[$arg]}" ]; then
            TARGETS+=("$arg")
        else
            echo "⚠️  Skipping unknown app: $arg"
        fi
    done
else
    # BATCH MODE
    IS_BATCH_MODE=true
    echo "📋 Available apps to build: ${!APPS[@]}"
    read -p "No apps specified. Build ALL apps? (y/N): " confirm
    if [[ "$confirm" =~ ^[yY]$ ]]; then
        TARGETS=("${!APPS[@]}")
    else
        echo "❌ Operation cancelled."
        exit 0
    fi
fi

if [ ${#TARGETS[@]} -eq 0 ]; then
    echo "❌ No valid apps to build. Exiting."
    exit 1
fi

# --- 3. Build and Deploy Apps ---
for APP in "${TARGETS[@]}"; do
    IFS='|' read -r SRC_DIR REL_DEST <<< "${APPS[$APP]}"
    
    # Calculate destination based on current mode (Production vs Testing)
    DEPLOY_DIR="$DEPLOY_ROOT/$REL_DEST"
    DEPLOY_DIR="${DEPLOY_DIR//\/.\//\/}" 
    
    echo "-------------------------------------------------------"
    echo "🏗️  Starting Build for: $APP"
    echo "📍 Source: $SRC_DIR"
    echo "-------------------------------------------------------"

    if [ -d "$SRC_DIR" ]; then
        echo "📂 Entering $SRC_DIR..."
        cd "$SRC_DIR"
    else
        echo "❌ Error: Source directory $SRC_DIR does not exist."
        FAILURES+=("$APP (Source missing)")
        if [ "$IS_BATCH_MODE" = false ]; then exit 1; fi
        continue
    fi

    echo "🧹 Cleaning local build artifacts (dist)..."
    sudo rm -rf dist

    echo "📦 Building project inside Docker (Node 20)..."
    # Construct the correct VITE_APP_BASE for the sub-application.
    # For the portal itself (REL_DEST="."), VITE_APP_BASE will be $WEB_BASE_URL (e.g., /public/).
    # For other apps (e.g., parts, projects), it will be $WEB_BASE_URL/app_name/ (e.g., /public/parts/).
    APP_SPECIFIC_VITE_APP_BASE="${WEB_BASE_URL}${REL_DEST}/"
    if ! docker run --rm -e VITE_APP_BASE="$APP_SPECIFIC_VITE_APP_BASE" -e VITE_PB_URL="$PB_URL" -v "$PWD":/app -w /app node:20 /bin/sh -c "npm install && npm run build"; then
        echo "❌ BUILD FAILED for $APP"
        if [ "$IS_BATCH_MODE" = false ]; then
            echo "⛔ Stopping execution due to build failure in manual mode."
            exit 1
        else
            FAILURES+=("$APP")
            echo "⚠️  Skipping deployment for $APP and continuing..."
            continue
        fi
    fi

    if [ ! -d "dist" ]; then
        echo "❌ Error: Build succeeded but 'dist' folder is missing."
        FAILURES+=("$APP (No dist folder)")
        if [ "$IS_BATCH_MODE" = false ]; then exit 1; fi
        continue
    fi

    echo "-------------------------------------------------------"
    echo "🚀 Deploying $APP to: $DEPLOY_DIR"
    echo "-------------------------------------------------------"

    if [ ! -d "$DEPLOY_DIR" ]; then
        echo "📁 Creating deployment directory..."
        sudo mkdir -p "$DEPLOY_DIR"
    fi

    echo "🔄 Syncing artifacts..."
    shopt -s dotglob
    
    for artifact in dist/*; do
        [ -e "$artifact" ] || continue
        base_name=$(basename "$artifact")
        dest_path="$DEPLOY_DIR/$base_name"
        SKIP_FILE=false
        
        # Check against App paths
        for OTHER_APP in "${!APPS[@]}"; do
            OTHER_REL="${APPS[$OTHER_APP]##*|}"
            OTHER_FULL="$DEPLOY_ROOT/$OTHER_REL"
            OTHER_FULL="${OTHER_FULL//\/.\//\/}"
            if [[ "$dest_path" == "$OTHER_FULL" ]]; then
                echo "⛔ ALERT: Artifact '$base_name' conflicts with app '$OTHER_APP'. Skipping."
                SKIP_FILE=true
                break
            fi
        done
        
        # Check against Shared Resource paths
        for R_NAME in "${!SHARED_RESOURCES[@]}"; do
             IFS='|' read -r _ R_REL <<< "${SHARED_RESOURCES[$R_NAME]}"
             R_FULL="$DEPLOY_ROOT/$R_REL"
             R_FULL="${R_FULL//\/.\//\/}"
             if [[ "$dest_path" == "$R_FULL" ]]; then
                 echo "⛔ ALERT: Artifact '$base_name' conflicts with shared '$R_NAME'. Skipping."
                 SKIP_FILE=true
                 break
             fi
        done

        if [ "$SKIP_FILE" = true ]; then continue; fi

        if [ -e "$dest_path" ]; then sudo rm -rf "$dest_path"; fi
        sudo cp -R "$artifact" "$DEPLOY_DIR/"
    done
    shopt -u dotglob

    echo "🔐 Setting permissions for $APP..."
    sudo chown -R "$USER_GROUP" "$DEPLOY_DIR/"
    sudo chmod -R 755 "$DEPLOY_DIR/"
    echo "✅ $APP deployment complete!"
done

# --- 4. Deploy Shared Resources (Misc & API) ---
echo "-------------------------------------------------------"
echo "📂 Deploying Shared Resources (misc, api)"
echo "-------------------------------------------------------"

for RES in "${!SHARED_RESOURCES[@]}"; do
    IFS='|' read -r S_SRC S_REL <<< "${SHARED_RESOURCES[$RES]}"
    
    # DYNAMIC DESTINATION: Uses DEPLOY_ROOT
    S_DEST="$DEPLOY_ROOT/$S_REL"
    S_DEST="${S_DEST//\/.\//\/}"
    
    echo "👉 Processing: $RES -> $S_DEST"
    
    if [ -d "$S_SRC" ]; then
        PARENT_DIR=$(dirname "$S_DEST")
        if [ ! -d "$PARENT_DIR" ]; then sudo mkdir -p "$PARENT_DIR"; fi
        if [ -d "$S_DEST" ]; then sudo rm -rf "$S_DEST"; fi
        sudo cp -R "$S_SRC" "$S_DEST"
        sudo chown -R "$USER_GROUP" "$S_DEST"
        sudo chmod -R 755 "$S_DEST"
    else
        echo "⚠️  Warning: Source folder for $RES ($S_SRC) not found. Skipping."
    fi
done

# --- 5. Deploy Index Files (Static Locations) ---
echo "-------------------------------------------------------"
echo "📄 Deploying Index Files (Static Locations)"
echo "-------------------------------------------------------"

# Helper function for deploying single files
deploy_file() {
    local SRC="$1"
    local DEST="$2"
    
    if [ -f "$SRC" ]; then
        # Ensure parent dir exists
        local P_DIR=$(dirname "$DEST")
        if [ ! -d "$P_DIR" ]; then sudo mkdir -p "$P_DIR"; fi
        
        echo "👉 Copying $(basename $SRC) to $DEST..."
        sudo cp "$SRC" "$DEST"
        sudo chown "$USER_GROUP" "$DEST"
        sudo chmod 644 "$DEST"
    else
        echo "⚠️  Warning: $(basename $SRC) not found at $SRC"
    fi
}

# 5A. Public Index -> /opt/apache/www/public/index.php
#deploy_file "$INDEX_SOURCE_DIR/$FILE_PUBLIC_PHP" "/opt/apache/www/public/index.php"

# 5B. Root Index -> /opt/apache/www/index.php
deploy_file "$INDEX_SOURCE_DIR/$FILE_WWW_PHP" "/opt/apache/www/index.php"


# --- 6. Final Summary & Sync ---
echo "-------------------------------------------------------"
if [ ${#FAILURES[@]} -gt 0 ]; then
    echo "⚠️  COMPLETED WITH ERRORS"
    for F in "${FAILURES[@]}"; do echo " - $F"; done
    EXIT_CODE=1
else
    echo "✅ SUCCESS: All apps and shared resources processed."
    EXIT_CODE=0
fi

if [ -x "/usr/local/bin/resync-opt" ]; then
    echo "🔧 Running final permission resync..."
    sudo /usr/local/bin/resync-opt
fi

echo "🏁 Done."
exit $EXIT_CODE