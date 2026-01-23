<?php
header('Content-Type: application/json');

// Configuration (should match your main index.php or be configurable)
$ignore_items = ['.', '..', '.htaccess', 'index.php', 'data', 'config', 'api']; // Added 'api' to ignore
$explorer_path = './public/'; // Path relative to the web_apps root

$files_list = [];

if (is_dir($explorer_path)) {
    $raw_list = scandir($explorer_path);
    foreach ($raw_list as $item) {
        if (in_array($item, $ignore_items)) continue;

        $full_path = $explorer_path . $item;
        $type = is_dir($full_path) ? 'directory' : 'file';

        $files_list[] = [
            'name' => $item,
            'type' => $type
        ];
    }

    // Sort directories first, then files, both alphabetically
    usort($files_list, function($a, $b) {
        if ($a['type'] === 'directory' && $b['type'] !== 'directory') return -1;
        if ($a['type'] !== 'directory' && $b['type'] === 'directory') return 1;
        return strnatcasecmp($a['name'], $b['name']);
    });
}

echo json_encode($files_list);
?>