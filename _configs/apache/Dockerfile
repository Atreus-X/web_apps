FROM php:8.2-apache

# 1. Install dependencies required for Oracle Instant Client (libaio1t64, unzip)
# Note: libaio1 was renamed to libaio1t64 in newer Debian versions (Trixie/Sid).
RUN apt-get update && apt-get install -y \
    libaio1t64 \
    unzip \
    wget \
    && rm -rf /var/lib/apt/lists/*

# 2. Install Oracle Instant Client (Basic + SDK)
# We download version 21.12 (stable) from Oracle's repo
RUN mkdir -p /opt/oracle \
    && cd /opt/oracle \
    && wget https://download.oracle.com/otn_software/linux/instantclient/2112000/instantclient-basic-linux.x64-21.12.0.0.0dbru.zip \
    && wget https://download.oracle.com/otn_software/linux/instantclient/2112000/instantclient-sdk-linux.x64-21.12.0.0.0dbru.zip \
    && unzip instantclient-basic-linux.x64-21.12.0.0.0dbru.zip \
    && unzip instantclient-sdk-linux.x64-21.12.0.0.0dbru.zip \
    && rm *.zip \
    && mv instantclient_21_12 instantclient

# 3. Add Oracle Instant Client to system library path
ENV LD_LIBRARY_PATH=/opt/oracle/instantclient

# 4. Configure and Install OCI8 (and PDO_OCI)
# We use docker-php-ext-configure to point PHP to the Instant Client location
RUN docker-php-ext-configure oci8 --with-oci8=instantclient,/opt/oracle/instantclient \
    && docker-php-ext-configure pdo_oci --with-pdo-oci=instantclient,/opt/oracle/instantclient \
    && docker-php-ext-install oci8 pdo_oci \
    && docker-php-ext-enable oci8 pdo_oci

# 5. Install standard MySQL database extensions
RUN docker-php-ext-install mysqli pdo pdo_mysql && docker-php-ext-enable mysqli

# 6. Enable essential modules for Traefik and Web Apps
RUN a2enmod rewrite remoteip headers