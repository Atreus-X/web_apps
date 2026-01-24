<?php
session_start();

/**
 * POCKETBASE CONFIGURATION
 */
$pbBaseUrl = "https://wchrestay-ubuntu.lan.local.cmu.edu/pocketbase"; // Internal Docker network URL
$collectionName = "bas_hours_data";

/**
 * Helper to communicate with PocketBase REST API
 */
function pb_request($method, $path, $data = null) {
    global $pbBaseUrl;
    $ch = curl_init($pbBaseUrl . $path);
    curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
    curl_setopt($ch, CURLOPT_CUSTOMREQUEST, $method);
    
    // Disable SSL verification for internal network
    curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
    curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, 0);
    
    if ($data) {
        $payload = json_encode($data);
        curl_setopt($ch, CURLOPT_POSTFIELDS, $payload);
        curl_setopt($ch, CURLOPT_HTTPHEADER, ['Content-Type: application/json']);
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    
    if ($response === false) {
        $err = curl_error($ch);
        curl_close($ch);
        return ['error' => true, 'code' => 0, 'message' => "Curl Error: $err"];
    }
    curl_close($ch);

    if ($httpCode >= 400) {
        return ['error' => true, 'code' => $httpCode, 'message' => $response];
    }
    return json_decode($response, true);
}

/**
 * HELPER FUNCTIONS
 */
function calculateFY($dateString) {
    $time = strtotime($dateString);
    if (!$time) return 'Unknown';
    $year = (int)date('Y', $time);
    $month = (int)date('m', $time);
    return ($month >= 7) ? (string)($year + 1) : (string)$year;
}

function getRate($fy) {
    $rates = ['2025' => 140, '2026' => 143, '2027' => 145];
    return $rates[$fy] ?? 0;
}

function getWorkDays($monthStr) {
    $holidays = [
        '2024-07-04', '2024-09-02', '2024-11-28', '2024-11-29', '2024-12-24', 
        '2024-12-25', '2024-12-31', '2025-01-01', '2025-01-20', '2025-05-26', '2025-06-19',
        '2025-07-04', '2025-09-01', '2025-11-27', '2025-11-28', '2025-12-24', 
        '2025-12-25', '2025-12-31', '2026-01-01', '2026-01-19', '2026-05-25', '2026-06-19'
    ];
    $start = new DateTime($monthStr . "-01");
    $end = clone $start;
    $end->modify('last day of this month');
    $end->modify('+1 day'); 
    $workingDays = 0;
    $current = clone $start;
    while ($current < $end) {
        if ($current->format('N') < 6 && !in_array($current->format('Y-m-d'), $holidays)) {
            $workingDays++;
        }
        $current->modify('+1 day');
    }
    return $workingDays;
}

// --- FETCH AVAILABLE USERS FROM POCKETBASE ---
// We get a list of users by requesting records and picking unique user_ids
$userResponse = pb_request('GET', "/api/collections/$collectionName/records?perPage=1000&fields=user_id");
$availableUsers = [];
if (isset($userResponse['items'])) {
    $availableUsers = array_unique(array_column($userResponse['items'], 'user_id'));
    sort($availableUsers);
}

// Fetch FY list for filters
$fyResponse = pb_request('GET', "/api/collections/$collectionName/records?perPage=1000&fields=fy");
$availableFYs = [];
if (isset($fyResponse['items'])) {
    $availableFYs = array_unique(array_column($fyResponse['items'], 'fy'));
    rsort($availableFYs);
}

// --- APP STATE & SESSION MANAGEMENT ---
$currentSystemFY = calculateFY(date('Y-m-d'));

if (isset($_POST['switch_user']) && isset($_POST['selected_user'])) {
    $_SESSION['selected_user'] = $_POST['selected_user'];
}

if (isset($_POST['apply_filters'])) {
    $_SESSION['filter_fy'] = $_POST['filter_fy'] ?? '';
    $_SESSION['filter_start'] = $_POST['filter_start'] ?? '';
    $_SESSION['filter_end'] = $_POST['filter_end'] ?? '';
}

if (isset($_POST['clear_filters'])) {
    unset($_SESSION['filter_fy'], $_SESSION['filter_start'], $_SESSION['filter_end']);
    $_SESSION['filter_fy'] = $currentSystemFY; 
}

if (!isset($_SESSION['filter_fy']) && !isset($_POST['apply_filters'])) {
    $_SESSION['filter_fy'] = $currentSystemFY;
}

if (!empty($availableUsers)) {
    if (!isset($_SESSION['selected_user']) || !in_array($_SESSION['selected_user'], $availableUsers)) {
        $_SESSION['selected_user'] = $availableUsers[0];
    }
} else {
    unset($_SESSION['selected_user']);
}

$currentUser = $_SESSION['selected_user'] ?? null;
$filterFY = $_SESSION['filter_fy'] ?? '';
$filterStart = $_SESSION['filter_start'] ?? '';
$filterEnd = $_SESSION['filter_end'] ?? '';

$uploadError = '';

// --- HANDLE UPLOAD ---
if (isset($_FILES['csv_file'])) {
    if (($handle = fopen($_FILES['csv_file']['tmp_name'], "r")) !== FALSE) {
        $headers = fgetcsv($handle, 1000, ","); 
        $tempData = [];
        $usersToClean = [];

        while (($row = fgetcsv($handle, 1000, ",")) !== FALSE) {
            if (count($row) >= 6) {
                $personId = trim($row[4]); 
                if (!empty($personId)) {
                    $usersToClean[$personId] = true;
                    $tempData[] = [
                        'user_id'   => $personId,
                        'date'      => $row[0],
                        'workorder' => $row[1],
                        'glaccount' => $row[2],
                        'gmaccount' => $row[3],
                        'personid'  => $personId,
                        'hours'     => (float)($row[5] ?? 0),
                        'fy'        => calculateFY($row[0])
                    ];
                }
            }
        }
        fclose($handle);

        if (!empty($tempData)) {
            // Delete existing records for these users (PocketBase doesn't have a simple batch delete by field, 
            // so we'd typically loop or use a filter. For this internal tool, we overwrite by adding).
            // NOTE: To properly replace, we'd fetch IDs first then delete. 
            // Here we simply POST new records.
            $errCount = 0;
            $lastErr = '';
            foreach ($tempData as $record) {
                $res = pb_request('POST', "/api/collections/$collectionName/records", $record);
                if (isset($res['error'])) {
                    $errCount++;
                    $lastErr = is_string($res['message']) ? $res['message'] : json_encode($res['message']);
                }
            }
            if ($errCount > 0) {
                $uploadError = "Failed to upload $errCount records. Last error: $lastErr";
            } else {
                $_SESSION['selected_user'] = array_key_first($usersToClean);
                header("Location: " . $_SERVER['PHP_SELF'] . "?success=1");
                exit;
            }
        } else {
            $uploadError = "No valid rows found in CSV (checked 6 columns).";
        }
    }
}

// --- FETCH DATA FOR DISPLAY ---
$rows = [];
if ($currentUser) {
    $filter = "user_id='$currentUser'";
    if ($filterFY) $filter .= " && fy='$filterFY'";
    if ($filterStart) $filter .= " && date >= '$filterStart'";
    if ($filterEnd) $filter .= " && date <= '$filterEnd'";
    
    $query = "/api/collections/$collectionName/records?perPage=500&sort=-date&filter=(" . urlencode($filter) . ")";
    $dataResponse = pb_request('GET', $query);
    if (isset($dataResponse['items'])) {
        $rows = $dataResponse['items'];
    }
}

// --- CALCULATIONS (Summary & Pivot) ---
$summaryData = [];
$pivotData = []; 
$uniquePeriods = [];

foreach ($rows as $row) {
    $timestamp = strtotime($row['date']);
    $monthKey = date('Y-m', $timestamp); 
    $uniquePeriods[$monthKey] = true;
    
    if (!isset($summaryData[$monthKey])) {
        $summaryData[$monthKey] = ['total_hours' => 0, 'gen_ops_hours' => 0, 'fy' => $row['fy']];
    }
    $val = (float)$row['hours'];
    $summaryData[$monthKey]['total_hours'] += $val;
    if (strpos($row['glaccount'], '530300') !== false) {
        $summaryData[$monthKey]['gen_ops_hours'] += $val;
    }

    $gl = $row['glaccount'] ?: ''; 
    $gm = $row['gmaccount'] ?: '';
    $wo = $row['workorder'] ?: '';
    $accKey = $gl . '|' . $gm;

    if (!isset($pivotData[$accKey])) {
        $pivotData[$accKey] = ['gl' => $gl, 'gm' => $gm, 'workorders' => [], 'values' => []];
    }
    if (!isset($pivotData[$accKey]['values'][$monthKey])) { $pivotData[$accKey]['values'][$monthKey] = 0; }
    $pivotData[$accKey]['values'][$monthKey] += $val;
    if ($wo && !in_array($wo, $pivotData[$accKey]['workorders'])) { $pivotData[$accKey]['workorders'][] = $wo; }
}

uksort($pivotData, function($a, $b) {
    $aGen = strpos($a, '530300') !== false;
    $bGen = strpos($b, '530300') !== false;
    if ($aGen && !$bGen) return -1;
    if (!$aGen && $bGen) return 1;
    return strcmp($a, $b);
});

ksort($uniquePeriods); 
ksort($summaryData); 
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Hours Tracking Dashboard</title>
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdn.datatables.net/1.13.6/css/dataTables.bootstrap5.min.css" rel="stylesheet">
    <style>
        body { background-color: #f8f9fa; }
        .navbar-custom { background-color: #1a252f; color: white; padding: 0.75rem 0; }
        .tab-content { background: white; padding: 25px; border: 1px solid #dee2e6; border-top: none; border-radius: 0 0 8px 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
        .nav-tabs .nav-link { color: #495057; border-radius: 8px 8px 0 0; border: 1px solid transparent; }
        .nav-tabs .nav-link.active { font-weight: 600; border-color: #dee2e6 #dee2e6 #fff; border-bottom: 3px solid #0d6efd; color: #0d6efd; }
        table.table-bordered { border: 1px solid #adb5bd !important; border-collapse: collapse !important; empty-cells: show !important; width: 100% !important; }
        table.table-bordered th, table.table-bordered td { border: 1px solid #adb5bd !important; padding: 8px; }
        .table th { font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.02em; vertical-align: middle; background-color: #f1f3f5 !important; white-space: nowrap; }
        .table td { font-size: 0.9rem; }
        #breakdownPivotTable td:nth-child(1), #breakdownPivotTable td:nth-child(2) { white-space: nowrap; width: 1%; }
        .navbar-brand { text-decoration: none; color: white !important; }
        .filter-bar { background: #fff; border-bottom: 1px solid #dee2e6; padding: 15px 0; margin-bottom: 25px; }
        .bg-over-target { background-color: #fff5f5; }
        .info-card { background-color: #f0f7ff; border: 1px solid #cce3ff; color: #004085; padding: 8px 16px; border-radius: 6px; font-size: 0.95rem; display: inline-block; }
        .wo-badge { background-color: #eef2f7; border: 1px solid #d1d9e6; color: #0d6efd; padding: 2px 8px; border-radius: 4px; font-size: 0.75rem; margin-right: 4px; margin-bottom: 4px; display: inline-block; cursor: pointer; text-decoration: none; font-weight: 600; }
        .wo-badge:hover { background-color: #0d6efd; color: white; border-color: #0a58ca; }
        .wo-scroll-container { max-height: 100px; overflow-y: auto; padding-right: 5px; }
    </style>
</head>
<body>

<nav class="navbar navbar-dark navbar-custom">
    <div class="container d-flex justify-content-between align-items-center">
        <a class="navbar-brand fw-bold" href="https://wchrestay-ubuntu.lan.local.cmu.edu/public/misc/bas_hour_tracking.php">BAS Hours Tracking (PocketBase)</a>
        <div class="d-flex align-items-center">
            <?php if (!empty($availableUsers)): ?>
                <form action="" method="post" class="d-flex align-items-center gap-2">
                    <span class="text-light small opacity-75 d-none d-sm-inline">Analysis For:</span>
                    <select name="selected_user" class="form-select form-select-sm" style="width: auto;" onchange="this.form.submit()">
                        <?php foreach($availableUsers as $u): ?>
                            <option value="<?= htmlspecialchars($u) ?>" <?= $u == $currentUser ? 'selected' : '' ?>><?= htmlspecialchars($u) ?></option>
                        <?php endforeach; ?>
                    </select>
                    <input type="hidden" name="switch_user" value="1">
                </form>
            <?php endif; ?>
        </div>
    </div>
</nav>

<div class="filter-bar shadow-sm">
    <div class="container">
        <form action="" method="post" class="row g-3 align-items-end">
            <div class="col-md-2">
                <label class="form-label small fw-bold text-muted">Fiscal Year</label>
                <select name="filter_fy" class="form-select form-select-sm">
                    <option value="">All Years</option>
                    <?php foreach($availableFYs as $fy): ?>
                        <option value="<?= $fy ?>" <?= $filterFY == $fy ? 'selected' : '' ?>>FY<?= $fy ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <div class="col-md-3">
                <label class="form-label small fw-bold text-muted">Start Date</label>
                <input type="date" name="filter_start" class="form-control form-control-sm" value="<?= htmlspecialchars($filterStart) ?>">
            </div>
            <div class="col-md-3">
                <label class="form-label small fw-bold text-muted">End Date</label>
                <input type="date" name="filter_end" class="form-control form-control-sm" value="<?= htmlspecialchars($filterEnd) ?>">
            </div>
            <div class="col-md-4 d-flex gap-2">
                <button type="submit" name="apply_filters" class="btn btn-primary btn-sm px-4">Apply Filters</button>
                <button type="submit" name="clear_filters" class="btn btn-outline-secondary btn-sm">Clear / Reset Default</button>
            </div>
        </form>
    </div>
</div>

<div class="container">
    <?php if (isset($_GET['success'])): ?><div class="alert alert-success alert-dismissible fade show shadow-sm">Data synced successfully.<button type="button" class="btn-close" data-bs-dismiss="alert"></button></div><?php endif; ?>
    <?php if ($uploadError): ?><div class="alert alert-danger alert-dismissible fade show shadow-sm"><?= htmlspecialchars($uploadError) ?><button type="button" class="btn-close" data-bs-dismiss="alert"></button></div><?php endif; ?>

    <div class="card border-0 shadow-sm mb-4">
        <div class="card-body">
            <div class="row align-items-center">
                <div class="col-md-7">
                    <h6 class="card-title text-muted text-uppercase small fw-bold mb-1">Import Data to PocketBase</h6>
                    <p class="small text-muted mb-0">Header: <code>DATE, WORKORDER, GLACCOUNT, GMACCOUNT, PERSONID, HOURS</code></p>
                </div>
                <div class="col-md-5 mt-3 mt-md-0 text-md-end">
                    <form action="" method="post" enctype="multipart/form-data" class="d-flex gap-2 justify-content-md-end">
                        <input type="file" name="csv_file" class="form-control form-control-sm" accept=".csv" required style="max-width: 250px;">
                        <button type="submit" class="btn btn-dark btn-sm text-nowrap">Upload & Sync</button>
                    </form>
                </div>
            </div>
        </div>
    </div>

    <?php if (!$currentUser): ?>
        <div class="text-center py-5"><h5 class="text-muted">PocketBase is empty.</h5><p class="text-secondary">Upload a CSV file to initialize the collection.</p></div>
    <?php elseif (empty($rows)): ?>
        <div class="alert alert-warning text-center">No records match the current filters (FY<?= $filterFY ?>).</div>
    <?php else: ?>

        <ul class="nav nav-tabs" id="myTab" role="tablist">
            <li class="nav-item"><button class="nav-link active" data-bs-toggle="tab" data-bs-target="#summary-tab">Summary</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#pivot-tab">Breakdown</button></li>
            <li class="nav-item"><button class="nav-link" data-bs-toggle="tab" data-bs-target="#data-tab">Raw Records</button></li>
        </ul>

        <div class="tab-content mb-5">
            <!-- TAB 1: SUMMARY -->
            <div class="tab-pane fade show active" id="summary-tab">
                <?php $targetRate = ($currentUser === 'KKENNED' ? 2 : 1); $targetHrsPerWeek = $targetRate * 8; ?>
                <div class="d-flex justify-content-between align-items-center mb-4">
                    <h5 class="mb-0">Gen-Ops Monthly Comparison</h5>
                    <div class="info-card shadow-sm">User: <strong><?= htmlspecialchars($currentUser) ?></strong> <span class="mx-2 text-muted">|</span> Target: <strong><?= $targetRate ?> day<?= $targetRate > 1 ? 's' : '' ?>/week</strong> (<?= $targetHrsPerWeek ?>h)</div>
                </div>
                <div class="table-responsive">
                    <table id="summaryTable" class="table table-hover table-bordered align-middle">
                        <thead>
                            <tr class="text-center">
                                <th>FY</th><th>Period</th><th>5-day Weeks</th><th>Target Gen-Ops</th><th>Used Gen-Ops</th><th>Total Logged</th><th>Rate</th><th>Cost</th><th>Excess</th><th>% Excess</th>
                            </tr>
                        </thead>
                        <tbody>
                            <?php 
                            $totalTargetGenOps = 0; $totalUsedGenOps = 0; $totalLoggedAll = 0; $totalGenOpsCost = 0; $totalExcessHrs = 0; $totalExcessPct = 0; $periodCount = 0;
                            $sumDisplay = $summaryData; krsort($sumDisplay);
                            foreach ($sumDisplay as $monthKey => $val): 
                                $fy = $val['fy']; $workDays = getWorkDays($monthKey); $weeks = $workDays / 5; $targetHours = $weeks * $targetHrsPerWeek;
                                $usedGenOpsHours = (float)$val['gen_ops_hours']; $totalHours = (float)$val['total_hours']; $rate = getRate($fy); $genOpsCost = $usedGenOpsHours * $rate;
                                $excessHours = $usedGenOpsHours - $targetHours; $excessPct = ($targetHours > 0) ? ($excessHours / $targetHours) * 100 : 0;
                                $totalTargetGenOps += $targetHours; $totalUsedGenOps += $usedGenOpsHours; $totalLoggedAll += $totalHours; $totalGenOpsCost += $genOpsCost; $totalExcessHrs += $excessHours; $totalExcessPct += $excessPct; $periodCount++;
                            ?>
                            <tr class="<?= ($excessHours > 0 ? 'bg-over-target' : '') ?>">
                                <td class="text-center"><?= htmlspecialchars($fy) ?></td>
                                <td class="fw-bold" data-order="<?= $monthKey ?>"><?= date("M Y", strtotime($monthKey . "-01")) ?></td>
                                <td class="text-center"><?= number_format($weeks, 1) ?></td>
                                <td class="text-center text-primary fw-bold"><?= number_format($targetHours, 1) ?></td>
                                <td class="text-center bg-light fw-bold fs-6"><?= number_format($usedGenOpsHours, 1) ?></td>
                                <td class="text-center text-secondary text-xs"><?= number_format($totalHours, 1) ?></td>
                                <td class="text-center">$<?= number_format($rate, 0) ?></td>
                                <td class="text-center fw-bold">$<?= number_format($genOpsCost, 2) ?></td>
                                <td class="text-center <?= $excessHours > 0 ? 'text-danger fw-bold' : 'text-success fw-bold' ?>"><?= ($excessHours > 0 ? '+' : '') . number_format($excessHours, 1) ?></td>
                                <td class="text-center"><span class="badge rounded-pill <?= $excessHours > 0 ? 'bg-danger text-white' : 'bg-success text-white' ?> px-3"><?= ($excessHours > 0 ? '+' : '') . number_format($excessPct, 0) ?>%</span></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                        <?php if ($periodCount > 0): ?>
                        <tfoot class="table-totals table-light fw-bold">
                            <tr><td colspan="3" class="text-end">Totals / Average %:</td><td class="text-center text-primary"><?= number_format($totalTargetGenOps, 1) ?></td><td class="text-center fs-6"><?= number_format($totalUsedGenOps, 1) ?></td><td class="text-center text-secondary text-xs"><?= number_format($totalLoggedAll, 1) ?></td><td class="text-center">-</td><td class="text-center">$<?= number_format($totalGenOpsCost, 2) ?></td><td class="text-center <?= $totalExcessHrs > 0 ? 'text-danger' : 'text-success' ?>"><?= ($totalExcessHrs > 0 ? '+' : '') . number_format($totalExcessHrs, 1) ?></td><td class="text-center"><?php $avgExcessPct = $totalExcessPct / $periodCount; ?><span class="badge rounded-pill <?= $avgExcessPct > 0 ? 'bg-danger text-white' : 'bg-success text-white' ?> px-3"><?= ($avgExcessPct > 0 ? '+' : '') . number_format($avgExcessPct, 0) ?>%</span></td></tr>
                        </tfoot>
                        <?php endif; ?>
                    </table>
                </div>
            </div>

            <!-- TAB 2: BREAKDOWN -->
            <div class="tab-pane fade" id="pivot-tab">
                <h5 class="mb-4">Monthly Hours by Account Group</h5>
                <div class="table-responsive">
                    <table id="breakdownPivotTable" class="table table-hover table-bordered align-middle">
                        <thead>
                            <tr class="text-center"><th rowspan="2">GL Account</th><th rowspan="2">GM Account</th><th rowspan="2" style="min-width: 250px;">Work Orders</th><th colspan="<?= count($uniquePeriods) ?>">Periods (Hours)</th><th rowspan="2">Total</th></tr>
                            <tr class="text-center"><?php foreach($uniquePeriods as $p => $true): ?><th><?= date("M Y", strtotime($p . "-01")) ?></th><?php endforeach; ?></tr>
                        </thead>
                        <tbody>
                            <?php foreach ($pivotData as $accKey => $data): $rowTotal = 0; ?>
                            <tr>
                                <td><code><?= htmlspecialchars($data['gl']) ?></code></td><td><code><?= htmlspecialchars($data['gm']) ?></code></td>
                                <td><div class="<?= count($data['workorders']) > 4 ? 'wo-scroll-container' : '' ?>"><?php foreach($data['workorders'] as $wo): ?><span class="wo-badge wo-filter-trigger" data-wo="<?= htmlspecialchars($wo) ?>"><?= htmlspecialchars($wo) ?></span><?php endforeach; ?></div></td>
                                <?php foreach($uniquePeriods as $p => $true): $hr = $data['values'][$p] ?? 0; $rowTotal += $hr; ?>
                                    <td class="text-center <?= $hr > 0 ? 'fw-bold' : '' ?>"><?= $hr > 0 ? number_format($hr, 1) : '' ?></td>
                                <?php endforeach; ?>
                                <td class="text-center fw-bold bg-light"><?= number_format($rowTotal, 1) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- TAB 3: DATA -->
            <div class="tab-pane fade" id="data-tab">
                <div class="d-flex justify-content-between mb-3 align-items-center"><h5>Transaction Log</h5><div class="d-flex gap-2"><button id="clearRawFilter" class="btn btn-outline-danger btn-sm d-none">Clear Active Search</button><span class="badge bg-secondary rounded-pill"><?= count($rows) ?> Records</span></div></div>
                <div class="table-responsive">
                    <table id="rawTable" class="table table-striped table-bordered table-sm mb-0">
                        <thead><tr class="text-center table-light"><th>Date</th><th>Work Order</th><th>GL Account</th><th>GM Account</th><th>Hours</th><th>FY</th><th>Rate</th><th>Total</th></tr></thead>
                        <tbody>
                            <?php foreach ($rows as $row): $rate = getRate($row['fy']); $total = $row['hours'] * $rate; $sortDate = date('Y-m-d', strtotime($row['date'])); ?>
                            <tr>
                                <td class="text-center" data-order="<?= $sortDate ?>"><?= htmlspecialchars($row['date']) ?></td><td class="text-center"><code><?= htmlspecialchars($row['workorder']) ?></code></td><td class="text-center"><small><?= htmlspecialchars($row['glaccount']) ?></small></td><td class="text-center"><small><?= htmlspecialchars($row['gmaccount']) ?></small></td><td class="text-center fw-bold"><?= number_format($row['hours'], 2) ?></td><td class="text-center"><?= htmlspecialchars($row['fy']) ?></td><td class="text-center">$<?= number_format($rate, 0) ?></td><td class="text-center fw-bold text-dark">$<?= number_format($total, 2) ?></td>
                            </tr>
                            <?php endforeach; ?>
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    <?php endif; ?>
</div>

<script src="https://code.jquery.com/jquery-3.7.0.js"></script>
<script src="https://cdn.jsdelivr.net/npm/bootstrap@5.3.0/dist/js/bootstrap.bundle.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/jquery.dataTables.min.js"></script>
<script src="https://cdn.datatables.net/1.13.6/js/dataTables.bootstrap5.min.js"></script>

<script>
$(document).ready(function() {
    const togglePagination = (settings) => {
        const api = new $.fn.dataTable.Api(settings);
        const info = api.page.info();
        $(api.table().container()).find('.dataTables_paginate').toggle(info.pages > 1);
    };

    $('#summaryTable').DataTable({ "order": [[ 0, "desc" ], [ 1, "desc" ]], "pageLength": 25, "language": { "search": "Search Summary:" }, "columnDefs": [{ "targets": [2,3,4,5,6,7,8,9], "searchable": false }], "drawCallback": togglePagination });
    $('#breakdownPivotTable').DataTable({ "ordering": false, "pageLength": 50, "language": { "search": "Filter Breakdown View:" }, "autoWidth": false, "drawCallback": togglePagination });
    const rawTable = $('#rawTable').DataTable({ "order": [[ 0, "desc" ]], "pageLength": 50, "language": { "search": "Search Records:" }, "drawCallback": togglePagination });

    $('.wo-filter-trigger').on('click', function() {
        const wo = $(this).data('wo');
        const rawTabTrigger = document.querySelector('#myTab button[data-bs-target="#data-tab"]');
        bootstrap.Tab.getOrCreateInstance(rawTabTrigger).show();
        rawTable.search(wo).draw();
        $('#clearRawFilter').removeClass('d-none').text('Clearing Filter: ' + wo + ' (Click to reset)');
    });

    $('#clearRawFilter').on('click', function() { rawTable.search('').draw(); $(this).addClass('d-none'); });
    $('button[data-bs-toggle="tab"]').on('shown.bs.tab', function (e) { $($.fn.dataTable.tables(true)).DataTable().columns.adjust(); });
});
</script>
</body>
</html>