<?php
$servername = "localhost";
$port = "3307";
$username = "root";
$password = "";
$dbname = "eight_eleven_db";

$dsn = "mysql:host=$servername;port=$port;dbname=$dbname;charset=utf8mb4";
$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    $pdo = new PDO($dsn, $username, $password, $options);
} catch (\PDOException $e) {
    throw new \PDOException($e->getMessage(), (int)$e->getCode());
}

function insertUser($pdo, $username, $password, $fullName, $role) {
    $sql = "INSERT INTO TB_USERS (USERNAME, PASSWORD, FULL_NAME, ROLE) VALUES (?, ?, ?, ?)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$username, $password, $fullName, $role]);
    return $pdo->lastInsertId();
}

function insertProductVariant($pdo, $variantId, $productId, $variantName, $unitPrice, $stockQuantity, $unitOfMeasure, $reorderPoint) {
    $sql = "INSERT INTO TB_PRODUCT_VARIANTS (VARIANT_ID, PRODUCT_ID, VARIANT_NAME, UNIT_PRICE, STOCK_QUANTITY, UNIT_OF_MEASURE, REORDER_POINT) 
            VALUES (?, ?, ?, ?, ?, ?, ?)";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$variantId, $productId, $variantName, $unitPrice, $stockQuantity, $unitOfMeasure, $reorderPoint]);
}

function updateVariantPriceAndStock($pdo, $variantId, $newPrice, $newStock) {
    $sql = "UPDATE TB_PRODUCT_VARIANTS SET STOCK_QUANTITY = ?, UNIT_PRICE = ? WHERE VARIANT_ID = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$newStock, $newPrice, $variantId]);
}

function deleteTransactionItem($pdo, $itemId) {
    $sql = "DELETE FROM TB_TRANSACTION_ITEMS WHERE ITEM_ID = ?";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$itemId]);
}

function getActiveProductsWithVariants($pdo) {
    $sql = "SELECT p.PRODUCT_NAME, v.VARIANT_NAME, v.UNIT_PRICE, v.STOCK_QUANTITY 
            FROM TB_PRODUCTS p
            JOIN TB_PRODUCT_VARIANTS v ON p.PRODUCT_ID = v.PRODUCT_ID";
    return $pdo->query($sql)->fetchAll();
}