<?php
header('Content-Type: application/json');

$servername = "localhost";
$port = "3307";
$username = "root";
$password = "";
$dbname = "eight_eleven_db";

try {
    // Connect to MySQL server without database first to ensure the database exists
    $pdo = new PDO("mysql:host=$servername;port=$port;charset=utf8mb4", $username, $password, [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION
    ]);
    
    // Create database if not exists
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$dbname` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    
    // Connect to the specific database
    $pdo->exec("USE `$dbname`");
    
    // Read schema.sql
    $schemaFile = __DIR__ . '/schema.sql';
    if (!file_exists($schemaFile)) {
        echo json_encode(["status" => "error", "message" => "schema.sql not found."]);
        exit;
    }
    
    // Read schema lines and execute them
    $sql = file_get_contents($schemaFile);
    $pdo->exec($sql);
    
    // Check if categories are empty and seed default categories
    $catCheck = $pdo->query("SELECT COUNT(*) FROM TB_CATEGORIES")->fetchColumn();
    if ($catCheck == 0) {
        $pdo->exec("INSERT INTO TB_CATEGORIES (CATEGORY_ID, CATEGORY_NAME) VALUES 
            (1, 'Snacks'),
            (2, 'Beverages'),
            (3, 'Toiletries'),
            (4, 'Grains')");
    }
    
    // Check if users are empty and seed default users
    $userCheck = $pdo->query("SELECT COUNT(*) FROM TB_USERS")->fetchColumn();
    if ($userCheck == 0) {
        $pdo->exec("INSERT INTO TB_USERS (USER_ID, USERNAME, PASSWORD, FULL_NAME, ROLE, ACTIVE, REQUESTED_AT) VALUES 
            (1, 'owner1',   'Owner#1234!',   'Alma Sarmiento',  'Owner / Admin', 1, NOW()),
            (2, 'owner2',   'Owner#2345!',   'Bea Sarmiento',   'Owner / Admin', 1, NOW()),
            (3, 'cashier1', 'Cashier#1', 'Ina Santos',      'Cashier',       1, NOW()),
            (4, 'cashier2', 'Cashier#2', 'Joy Reyes',       'Cashier',       1, NOW()),
            (5, 'cashier3', 'Cashier#3', 'Kim Cruz',        'Cashier',       1, NOW())");
    }
    
    // Check if products are empty and seed default products & variants
    $prodCheck = $pdo->query("SELECT COUNT(*) FROM TB_PRODUCTS")->fetchColumn();
    if ($prodCheck == 0) {
        $pdo->exec("INSERT INTO TB_PRODUCTS (PRODUCT_ID, PRODUCT_NAME, CATEGORY_ID) VALUES 
            (1, 'Piattos', 1),
            (2, 'Rice', 4),
            (3, 'Coca-Cola Original', 2)");
            
        $pdo->exec("INSERT INTO TB_PRODUCT_VARIANTS (VARIANT_ID, PRODUCT_ID, VARIANT_NAME, UNIT_PRICE, STOCK_QUANTITY, UNIT_OF_MEASURE, REORDER_POINT) VALUES 
            (101, 1, 'Solo 40g', 20.00, 45, 'pack', 15),
            (102, 1, 'Buddy 85g', 38.00, 8, 'pack', 10),
            (103, 1, 'Super Size 170g', 68.00, 0, 'pack', 5),
            (201, 2, 'Per Kilo', 60.00, 50, 'kilo', 30),
            (302, 3, '1.5L Bottle', 65.00, 14, 'bottle', 10)");
    }
    
    echo json_encode(["status" => "success", "message" => "Database initialized and seeded successfully."]);
} catch (PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database connection/execution failed: " . $e->getMessage()]);
}
