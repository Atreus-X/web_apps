<?php
header('Content-Type: application/json');

// --- Configuration ---
// Load credentials from .env file
$envFile = __DIR__ . '/.env'; // Reference .env in the same directory
if (!file_exists($envFile)) {
    http_response_code(500);
    echo json_encode(['status' => 'error', 'message' => 'Configuration file (.env) not found in ' . __DIR__]);
    exit;
}

$lines = file($envFile, FILE_IGNORE_NEW_LINES | FILE_SKIP_EMPTY_LINES);
foreach ($lines as $line) {
    if (strpos(trim($line), '#') === 0) continue; // Skip comments
    if (strpos($line, '=') !== false) {
        list($name, $value) = explode('=', $line, 2);
        $value = trim(trim($value), "\"'"); // Remove quotes and whitespace
        putenv(trim($name) . "=$value");
    }
}

$db_username = getenv('ORACLE_USER');
$db_password = getenv('ORACLE_PASSWORD');
$db_connection_string = getenv('ORACLE_CONNECTION');

if (!$db_username || !$db_password || !$db_connection_string) {
    http_response_code(500);
    echo json_encode([
        'status' => 'error',
        'message' => 'Oracle database credentials (ORACLE_USER, ORACLE_PASSWORD, ORACLE_CONNECTION) missing or incomplete in .env file.'
    ]);
    exit;
}

$response = ['status' => 'success', 'message' => ''];
$conn = null; // Initialize connection variable

try {
    // Attempt to connect to Oracle
    // The '@' suppresses warnings, allowing oci_error() to capture the details
    $conn = @oci_connect($db_username, $db_password, $db_connection_string, 'AL32UTF8'); // Added character set for broader compatibility
    
    if (!$conn) {
        $e = oci_error();
        throw new Exception("Oracle Connection failed: " . ($e['message'] ?? 'Unknown connection error'));
    }

    $response['message'] = 'Successfully connected to Oracle database.';

    // Check for SQL query in POST request
    $sql_query = $_POST['sql_query'] ?? '';

    if ($sql_query) {
        // --- WARNING: DIRECTLY EXECUTING USER-PROVIDED SQL IS A MAJOR SECURITY RISK (SQL INJECTION) ---
        // For a production environment, NEVER do this without extensive sanitization,
        // whitelisting, or using prepared statements with bound parameters for specific,
        // predefined queries. This is for testing/debugging in a controlled environment only.
        
        $response['query_executed'] = $sql_query;
        $results = [];

        $stid = oci_parse($conn, $sql_query);
        if (!$stid) {
            $e = oci_error($conn);
            throw new Exception("SQL Parse error: " . ($e['message'] ?? 'Unknown parse error'));
        }

        $r = oci_execute($stid);
        if (!$r) {
            $e = oci_error($stid);
            throw new Exception("SQL Execute error: " . ($e['message'] ?? 'Unknown execute error'));
        }

        // Fetch results if it's a SELECT query (oci_num_fields returns 0 for DML statements)
        if (oci_num_fields($stid) > 0) {
            while ($row = oci_fetch_array($stid, OCI_ASSOC + OCI_RETURN_NULLS)) {
                $results[] = $row;
            }
            $response['data'] = $results;
            $response['message'] .= ' Query executed successfully. ' . count($results) . ' rows returned.';
        } else {
            // For DML statements (INSERT, UPDATE, DELETE)
            $rows_affected = oci_num_rows($stid);
            $response['message'] .= ' Query executed successfully. ' . $rows_affected . ' rows affected.';
        }

        oci_free_statement($stid);
    }

} catch (Exception $e) {
    http_response_code(500);
    $response = ['status' => 'error', 'message' => $e->getMessage()];
} finally {
    if ($conn) {
        oci_close($conn);
    }
}

echo json_encode($response);
?>
