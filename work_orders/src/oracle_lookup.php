<?php
header('Content-Type: application/json');

// --- Configuration ---
// Load credentials from external config file
// Adjust the path as needed based on your directory structure
require_once __DIR__ . '/../../config/oracle_credentials.php';

$wo_num = $_GET['wo'] ?? '';

if (!$wo_num) {
    echo json_encode(['error' => 'No WO number provided']);
    exit;
}

try {
    // Connect to Oracle (Requires php_oci8 extension)
    $conn = @oci_connect($db_username, $db_password, $db_connection_string);
    
    if (!$conn) {
        $e = oci_error();
        throw new Exception("Connection failed: " . $e['message']);
    }

    // Prepare query - Adjust table/column names to match your schema (e.g., MAXIMO.WORKORDER)
    $sql = "SELECT wonum, description, status, reportdate, location, reportedby 
            FROM workorder 
            WHERE wonum = :wo_num";
            
    $stid = oci_parse($conn, $sql);
    
    // Bind parameters to prevent SQL injection
    oci_bind_by_name($stid, ':wo_num', $wo_num);
    
    oci_execute($stid);
    
    $row = oci_fetch_array($stid, OCI_ASSOC + OCI_RETURN_NULLS);
    
    if ($row) {
        echo json_encode([
            'WO_NUMBER' => $row['WONUM'],
            'DESCRIPTION' => $row['DESCRIPTION'],
            'STATUS' => $row['STATUS'],
            'DATE_REPORTED' => $row['REPORTDATE'],
            'BLDG_ABBR' => $row['LOCATION'], 
            'CONTACT_NAME' => $row['REPORTEDBY']
        ]);
    } else {
        echo json_encode(['error' => 'Work Order not found']);
    }

    oci_free_statement($stid);
    oci_close($conn);

} catch (Exception $e) {
    http_response_code(500);
    echo json_encode(['error' => $e->getMessage()]);
}
?>
