<?php
// Configuration
$ignore_items = ['.', '..', '.htaccess', 'index.php', 'data', 'config'];
$explorer_path = './public/'; 

// Get Authelia Info
$user = $_SERVER['HTTP_REMOTE_USER'] ?? 'Guest';
$email = $_SERVER['HTTP_REMOTE_EMAIL'] ?? 'Unknown';

// Define Quick Links
$apps = [
    ['name' => 'Web-Apps Portal', 'url' => '/public/', 'icon' => 'fa-users', 'color' => 'bg-indigo-500', 'desc' => 'Web-Apps Portal'],
    ['name' => 'FileZilla', 'url' => '/filezilla/', 'icon' => 'fa-folder-open', 'color' => 'bg-amber-500', 'desc' => 'File manager'],
    ['name' => 'PocketBase', 'url' => '/pocketbase/_/', 'icon' => 'fa-database', 'color' => 'bg-cyan-500', 'desc' => 'Backend database console'],
    ['name' => 'Webmin', 'url' => '/webmin/', 'icon' => 'fa-server', 'color' => 'bg-rose-500', 'desc' => 'System admin']
];

// Scan physical directory
$dirs = [];
$files = [];
if (is_dir($explorer_path)) {
    $raw_list = scandir($explorer_path);
    foreach ($raw_list as $item) {
        if (in_array($item, $ignore_items)) continue;
        is_dir($explorer_path . $item) ? $dirs[] = $item : $files[] = $item;
    }
    natcasesort($dirs); natcasesort($files);
}
$sorted_items = array_merge($dirs, $files);
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Portal</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
</head>
<body class="bg-slate-50 text-slate-900 min-h-screen">
    <nav class="bg-white/80 backdrop-blur-md sticky top-0 z-50 border-b border-slate-200 px-6 py-3 flex justify-between items-center shadow-sm">
        <div class="flex items-center gap-3">
            <div class="bg-blue-600 p-2 rounded-lg text-white"><i class="fa-solid fa-microchip"></i></div>
            <h1 class="font-bold text-slate-800">Portal</h1>
        </div>
        <div class="text-right">
            <p class="text-sm font-bold text-blue-600"><?php echo htmlspecialchars($user); ?></p>
            <p class="text-xs text-slate-500"><?php echo htmlspecialchars($email); ?></p>
        </div>
    </nav>

    <main class="container mx-auto px-6 py-10">
        <h2 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 font-mono">Pinned Applications</h2>
        <!-- UPDATED: Grid columns set to 6 for larger screens to fit all apps in one row -->
        <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-12">
            <?php foreach($apps as $app): ?>
            <a href="<?php echo $app['url']; ?>" class="group bg-white rounded-xl shadow-sm border border-slate-200 p-5 hover:shadow-md transition-all">
                <div class="<?php echo $app['color']; ?> w-10 h-10 rounded-lg flex items-center justify-center text-white mb-3 group-hover:scale-110 transition-transform">
                    <i class="fa-solid <?php echo $app['icon']; ?>"></i>
                </div>
                <h3 class="font-bold text-slate-800 text-sm"><?php echo $app['name']; ?></h3>
            </a>
            <?php endforeach; ?>
        </div>

        <h2 class="text-xs font-bold text-slate-400 uppercase tracking-widest mb-6 font-mono">Public Files</h2>
        <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
            <table class="w-full text-left">
                <tbody class="divide-y divide-slate-100">
                    <?php foreach ($sorted_items as $item): 
                        $is_dir = is_dir($explorer_path . $item);
                        $icon = $is_dir ? 'fa-folder text-amber-400' : 'fa-file-code text-slate-400';
                    ?>
                    <tr class="hover:bg-slate-50 transition-colors">
                        <td class="px-6 py-4">
                            <div class="flex items-center gap-3">
                                <i class="fa-solid <?php echo $icon; ?>"></i>
                                <a href="/public/<?php echo $item; ?><?php echo $is_dir ? '/' : ''; ?>" class="text-slate-700 hover:text-blue-600 font-medium">
                                    <?php echo htmlspecialchars($item); ?><?php echo $is_dir ? '/' : ''; ?>
                                </a>
                            </div>
                        </td>
                    </tr>
                    <?php endforeach; ?>
                </tbody>
            </table>
        </div>
    </main>
</body>
</html>
