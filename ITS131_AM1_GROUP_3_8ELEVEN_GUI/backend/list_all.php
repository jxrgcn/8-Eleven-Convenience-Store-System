<?php
require_once 'database.php';
echo "=== TB_USERS ===\n";
foreach($pdo->query('SELECT * FROM TB_USERS') as $r) {
    echo "ID: {$r['USER_ID']} | Username: {$r['USERNAME']} | Active: {$r['ACTIVE']}\n";
}
echo "\n=== TB_ACCOUNT_REQUESTS ===\n";
foreach($pdo->query('SELECT * FROM TB_ACCOUNT_REQUESTS') as $r) {
    echo "ID: {$r['REQUEST_ID']} | Username: {$r['USERNAME']} | Status: {$r['STATUS']}\n";
}
