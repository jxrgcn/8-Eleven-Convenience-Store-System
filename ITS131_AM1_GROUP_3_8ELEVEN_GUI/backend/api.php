<?php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Content-Type: application/json");

require_once __DIR__ . '/database.php';

$input = json_decode(file_get_contents('php://input'), true);
$action = isset($_GET['action']) ? $_GET['action'] : (isset($input['action']) ? $input['action'] : '');

if (!$action) {
    echo json_encode(["status" => "error", "message" => "No action specified."]);
    exit;
}

try {
    switch ($action) {
        case 'get_state':
            // 1. Categories
            $categories = [];
            $catStmt = $pdo->query("SELECT CATEGORY_ID AS id, CATEGORY_NAME AS name FROM TB_CATEGORIES");
            while ($row = $catStmt->fetch()) {
                $categories[] = [
                    "id" => (int)$row['id'],
                    "name" => $row['name']
                ];
            }

            // 2. Users (active)
            $users = [];
            $userStmt = $pdo->query("SELECT USER_ID AS userId, USERNAME AS username, PASSWORD AS password, FULL_NAME AS fullName, ROLE AS role, ACTIVE AS active FROM TB_USERS WHERE ACTIVE = 1");
            while ($row = $userStmt->fetch()) {
                $users[] = [
                    "userId" => (int)$row['userId'],
                    "username" => $row['username'],
                    "password" => $row['password'],
                    "fullName" => $row['fullName'],
                    "role" => $row['role'],
                    "active" => (bool)$row['active']
                ];
            }

            // 3. Pending Accounts (inactive users)
            $pendingAccounts = [];
            $pendingStmt = $pdo->query("SELECT REQUEST_ID AS requestId, USERNAME AS username, PASSWORD AS password, FULL_NAME AS fullName, ROLE AS role, REQUEST_DATE AS requestedAt FROM TB_ACCOUNT_REQUESTS WHERE STATUS = 'Pending'");
            while ($row = $pendingStmt->fetch()) {
                $pendingAccounts[] = [
                    "requestId" => (int)$row['requestId'],
                    "username" => $row['username'],
                    "password" => $row['password'],
                    "fullName" => $row['fullName'],
                    "role" => $row['role'],
                    "requestedAt" => $row['requestedAt'] ? date('c', strtotime($row['requestedAt'])) : date('c'),
                    "approved" => false
                ];
            }

            // 4. Products with nested variants
            $products = [];
            $prodStmt = $pdo->query("SELECT PRODUCT_ID AS id, PRODUCT_NAME AS name, CATEGORY_ID AS categoryId FROM TB_PRODUCTS");
            $productsMap = [];
            while ($row = $prodStmt->fetch()) {
                $productsMap[$row['id']] = [
                    "id" => (int)$row['id'],
                    "name" => $row['name'],
                    "categoryId" => $row['categoryId'] !== null ? (int)$row['categoryId'] : null,
                    "variants" => []
                ];
            }

            $varStmt = $pdo->query("SELECT VARIANT_ID AS id, PRODUCT_ID AS productId, VARIANT_NAME AS name, UNIT_PRICE AS unitPrice, STOCK_QUANTITY AS stockQuantity, UNIT_OF_MEASURE AS unitOfMeasure, REORDER_POINT AS reorderPoint FROM TB_PRODUCT_VARIANTS");
            while ($row = $varStmt->fetch()) {
                $pId = $row['productId'];
                if (isset($productsMap[$pId])) {
                    $productsMap[$pId]["variants"][] = [
                        "id" => (int)$row['id'],
                        "name" => $row['name'],
                        "unitPrice" => (float)$row['unitPrice'],
                        "stockQuantity" => (int)$row['stockQuantity'],
                        "unitOfMeasure" => $row['unitOfMeasure'],
                        "reorderPoint" => (int)$row['reorderPoint']
                    ];
                }
            }
            $products = array_values($productsMap);

            // 5. Transactions with nested items
            $transactions = [];
            $txStmt = $pdo->query("SELECT TRANSACTION_ID AS id, TRANSACTION_DATE AS date, TOTAL_AMOUNT AS totalAmount, PAYMENT_METHOD AS paymentMethod, USER_ID AS userId, CLERK_NAME AS clerkName FROM TB_TRANSACTIONS ORDER BY TRANSACTION_ID DESC");
            $transactionsMap = [];
            while ($row = $txStmt->fetch()) {
                $transactionsMap[$row['id']] = [
                    "id" => (int)$row['id'],
                    "date" => date('c', strtotime($row['date'])),
                    "totalAmount" => (float)$row['totalAmount'],
                    "paymentMethod" => $row['paymentMethod'],
                    "userId" => (int)$row['userId'],
                    "clerkName" => $row['clerkName'],
                    "items" => []
                ];
            }

            $itemStmt = $pdo->query("SELECT ITEM_ID AS itemId, TRANSACTION_ID AS transactionId, VARIANT_ID AS variantId, QUANTITY AS quantity, PRICE_AT_SALE AS priceAtSale FROM TB_TRANSACTION_ITEMS");
            while ($row = $itemStmt->fetch()) {
                $txId = $row['transactionId'];
                if (isset($transactionsMap[$txId])) {
                    $transactionsMap[$txId]["items"][] = [
                        "variantId" => (int)$row['variantId'],
                        "quantity" => (int)$row['quantity'],
                        "priceAtSale" => (float)$row['priceAtSale']
                    ];
                }
            }
            $transactions = array_values($transactionsMap);

            // 6. Stockin Logs
            $stockInLogs = [];
            $logStmt = $pdo->query("SELECT LOG_ID AS id, VARIANT_ID AS variantId, QUANTITY_ADDED AS quantityAdded, DATE_LOGGED AS date, USER_ID AS userId, USER_NAME AS userName FROM TB_STOCKIN_LOGS ORDER BY LOG_ID DESC");
            while ($row = $logStmt->fetch()) {
                $stockInLogs[] = [
                    "id" => (int)$row['id'],
                    "variantId" => (int)$row['variantId'],
                    "quantityAdded" => (int)$row['quantityAdded'],
                    "date" => date('c', strtotime($row['date'])),
                    "userId" => (int)$row['userId'],
                    "userName" => $row['userName']
                ];
            }

            echo json_encode([
                "status" => "success",
                "state" => [
                    "categories" => $categories,
                    "users" => $users,
                    "pendingAccounts" => $pendingAccounts,
                    "products" => $products,
                    "transactions" => $transactions,
                    "stockInLogs" => $stockInLogs
                ]
            ]);
            break;

        case 'request_account':
            $fullName = $input['fullName'];
            $username = $input['username'];
            $password = $input['password'];
            $role = $input['role'];

            $stmt = $pdo->prepare("INSERT INTO TB_ACCOUNT_REQUESTS (FULL_NAME, USERNAME, PASSWORD, ROLE, STATUS, REQUEST_DATE) VALUES (?, ?, ?, ?, 'Pending', NOW())");
            $stmt->execute([$fullName, $username, $password, $role]);
            
            echo json_encode(["status" => "success", "message" => "Account request submitted."]);
            break;

        case 'approve_account':
            $requestId = $input['requestId'];
            
            $pdo->beginTransaction();
            try {
                $stmt = $pdo->prepare("SELECT * FROM TB_ACCOUNT_REQUESTS WHERE REQUEST_ID = ?");
                $stmt->execute([$requestId]);
                $request = $stmt->fetch();
                
                if ($request) {
                    $userStmt = $pdo->prepare("INSERT INTO TB_USERS (USERNAME, PASSWORD, FULL_NAME, ROLE, ACTIVE, REQUESTED_AT) VALUES (?, ?, ?, ?, 1, ?)");
                    $userStmt->execute([
                        $request['USERNAME'],
                        $request['PASSWORD'],
                        $request['FULL_NAME'],
                        $request['ROLE'],
                        $request['REQUEST_DATE']
                    ]);
                    
                    $updateStmt = $pdo->prepare("UPDATE TB_ACCOUNT_REQUESTS SET STATUS = 'Approved' WHERE REQUEST_ID = ?");
                    $updateStmt->execute([$requestId]);
                    
                    $pdo->commit();
                    echo json_encode(["status" => "success", "message" => "Account approved."]);
                } else {
                    $pdo->rollBack();
                    echo json_encode(["status" => "error", "message" => "Account request not found."]);
                }
            } catch (Exception $ex) {
                $pdo->rollBack();
                echo json_encode(["status" => "error", "message" => "Approval failed: " . $ex->getMessage()]);
            }
            break;

        case 'reject_account':
            $requestId = $input['requestId'];
            $stmt = $pdo->prepare("UPDATE TB_ACCOUNT_REQUESTS SET STATUS = 'Rejected' WHERE REQUEST_ID = ?");
            $stmt->execute([$requestId]);

            echo json_encode(["status" => "success", "message" => "Account request rejected."]);
            break;

        case 'add_category':
            $name = $input['name'];
            $stmt = $pdo->prepare("INSERT INTO TB_CATEGORIES (CATEGORY_NAME) VALUES (?)");
            $stmt->execute([$name]);

            echo json_encode(["status" => "success", "id" => $pdo->lastInsertId()]);
            break;

        case 'delete_category':
            $id = $input['id'];
            $stmt = $pdo->prepare("DELETE FROM TB_CATEGORIES WHERE CATEGORY_ID = ?");
            $stmt->execute([$id]);

            echo json_encode(["status" => "success"]);
            break;

        case 'save_product':
            $productId = isset($input['productId']) ? $input['productId'] : null;
            $name = $input['name'];
            $categoryId = $input['categoryId'];
            $variants = $input['variants'];

            $pdo->beginTransaction();

            if ($productId) {
                // Update
                $stmt = $pdo->prepare("UPDATE TB_PRODUCTS SET PRODUCT_NAME = ?, CATEGORY_ID = ? WHERE PRODUCT_ID = ?");
                $stmt->execute([$name, $categoryId, $productId]);
            } else {
                // Insert new
                $stmt = $pdo->prepare("INSERT INTO TB_PRODUCTS (PRODUCT_NAME, CATEGORY_ID) VALUES (?, ?)");
                $stmt->execute([$name, $categoryId]);
                $productId = $pdo->lastInsertId();
            }

            // Replace variants
            $stmtDel = $pdo->prepare("DELETE FROM TB_PRODUCT_VARIANTS WHERE PRODUCT_ID = ?");
            $stmtDel->execute([$productId]);

            foreach ($variants as $v) {
                insertProductVariant($pdo, $v['id'], $productId, $v['name'], $v['unitPrice'], $v['stockQuantity'], $v['unitOfMeasure'], $v['reorderPoint']);
            }

            $pdo->commit();
            echo json_encode(["status" => "success", "productId" => (int)$productId]);
            break;

        case 'delete_product':
            $id = $input['id'];
            $stmt = $pdo->prepare("DELETE FROM TB_PRODUCTS WHERE PRODUCT_ID = ?");
            $stmt->execute([$id]);

            echo json_encode(["status" => "success"]);
            break;

        case 'post_stockin':
            $variantId = $input['variantId'];
            $quantityAdded = $input['quantityAdded'];
            $userId = $input['userId'];
            $userName = $input['userName'];

            $pdo->beginTransaction();

            $stmt = $pdo->prepare("SELECT UNIT_PRICE, STOCK_QUANTITY FROM TB_PRODUCT_VARIANTS WHERE VARIANT_ID = ?");
            $stmt->execute([$variantId]);
            $v = $stmt->fetch();
            if (!$v) {
                throw new Exception("Variant not found.");
            }

            $newStock = $v['STOCK_QUANTITY'] + $quantityAdded;
            updateVariantPriceAndStock($pdo, $variantId, $v['UNIT_PRICE'], $newStock);

            $logStmt = $pdo->prepare("INSERT INTO TB_STOCKIN_LOGS (VARIANT_ID, QUANTITY_ADDED, DATE_LOGGED, USER_ID, USER_NAME) VALUES (?, ?, NOW(), ?, ?)");
            $logStmt->execute([$variantId, $quantityAdded, $userId, $userName]);

            $pdo->commit();
            echo json_encode(["status" => "success", "newStock" => $newStock]);
            break;

        case 'checkout':
            $totalAmount = $input['totalAmount'];
            $paymentMethod = $input['paymentMethod'];
            $userId = $input['userId'];
            $clerkName = $input['clerkName'];
            $items = $input['items'];
            $date = isset($input['date']) ? date('Y-m-d H:i:s', strtotime($input['date'])) : date('Y-m-d H:i:s');

            $pdo->beginTransaction();

            $stmt = $pdo->prepare("INSERT INTO TB_TRANSACTIONS (TRANSACTION_DATE, TOTAL_AMOUNT, PAYMENT_METHOD, USER_ID, CLERK_NAME) VALUES (?, ?, ?, ?, ?)");
            $stmt->execute([$date, $totalAmount, $paymentMethod, $userId, $clerkName]);
            $transactionId = $pdo->lastInsertId();

            foreach ($items as $item) {
                $itemStmt = $pdo->prepare("INSERT INTO TB_TRANSACTION_ITEMS (TRANSACTION_ID, VARIANT_ID, QUANTITY, PRICE_AT_SALE) VALUES (?, ?, ?, ?)");
                $itemStmt->execute([$transactionId, $item['variantId'], $item['quantity'], $item['priceAtSale']]);

                $vStmt = $pdo->prepare("SELECT UNIT_PRICE, STOCK_QUANTITY FROM TB_PRODUCT_VARIANTS WHERE VARIANT_ID = ?");
                $vStmt->execute([$item['variantId']]);
                $v = $vStmt->fetch();
                if ($v) {
                    $newStock = max(0, $v['STOCK_QUANTITY'] - $item['quantity']);
                    updateVariantPriceAndStock($pdo, $item['variantId'], $v['UNIT_PRICE'], $newStock);
                }
            }

            $pdo->commit();
            echo json_encode(["status" => "success", "transactionId" => (int)$transactionId]);
            break;

        case 'sync_offline':
            $transactionsList = $input['transactions'];
            $pdo->beginTransaction();

            foreach ($transactionsList as $tx) {
                $date = date('Y-m-d H:i:s', strtotime($tx['date']));
                $stmt = $pdo->prepare("INSERT INTO TB_TRANSACTIONS (TRANSACTION_DATE, TOTAL_AMOUNT, PAYMENT_METHOD, USER_ID, CLERK_NAME) VALUES (?, ?, ?, ?, ?)");
                $stmt->execute([$date, $tx['totalAmount'], $tx['paymentMethod'], $tx['userId'], $tx['clerkName']]);
                $transactionId = $pdo->lastInsertId();

                foreach ($tx['items'] as $item) {
                    $itemStmt = $pdo->prepare("INSERT INTO TB_TRANSACTION_ITEMS (TRANSACTION_ID, VARIANT_ID, QUANTITY, PRICE_AT_SALE) VALUES (?, ?, ?, ?)");
                    $itemStmt->execute([$transactionId, $item['variantId'], $item['quantity'], $item['priceAtSale']]);

                    $vStmt = $pdo->prepare("SELECT UNIT_PRICE, STOCK_QUANTITY FROM TB_PRODUCT_VARIANTS WHERE VARIANT_ID = ?");
                    $vStmt->execute([$item['variantId']]);
                    $v = $vStmt->fetch();
                    if ($v) {
                        $newStock = max(0, $v['STOCK_QUANTITY'] - $item['quantity']);
                        updateVariantPriceAndStock($pdo, $item['variantId'], $v['UNIT_PRICE'], $newStock);
                    }
                }
            }

            $pdo->commit();
            echo json_encode(["status" => "success", "message" => "Offline transactions synced."]);
            break;

        case 'restore_backup':
            $backupData = $input['backupData'];

            $pdo->beginTransaction();

            $pdo->exec("SET FOREIGN_KEY_CHECKS = 0;");
            $pdo->exec("TRUNCATE TABLE TB_TRANSACTION_ITEMS;");
            $pdo->exec("TRUNCATE TABLE TB_TRANSACTIONS;");
            $pdo->exec("TRUNCATE TABLE TB_STOCKIN_LOGS;");
            $pdo->exec("TRUNCATE TABLE TB_PRODUCT_VARIANTS;");
            $pdo->exec("TRUNCATE TABLE TB_PRODUCTS;");
            $pdo->exec("TRUNCATE TABLE TB_CATEGORIES;");
            $pdo->exec("TRUNCATE TABLE TB_USERS;");
            $pdo->exec("TRUNCATE TABLE TB_ACCOUNT_REQUESTS;");
            $pdo->exec("SET FOREIGN_KEY_CHECKS = 1;");

            foreach ($backupData['categories'] as $c) {
                $stmt = $pdo->prepare("INSERT INTO TB_CATEGORIES (CATEGORY_ID, CATEGORY_NAME) VALUES (?, ?)");
                $stmt->execute([$c['id'], $c['name']]);
            }

            foreach ($backupData['users'] as $u) {
                $stmt = $pdo->prepare("INSERT INTO TB_USERS (USER_ID, USERNAME, PASSWORD, FULL_NAME, ROLE, ACTIVE, REQUESTED_AT) VALUES (?, ?, ?, ?, ?, ?, NOW())");
                $stmt->execute([$u['userId'], $u['username'], $u['password'], $u['fullName'], $u['role'], isset($u['active']) ? ($u['active'] ? 1 : 0) : 1]);
            }

            if (isset($backupData['pendingAccounts'])) {
                foreach ($backupData['pendingAccounts'] as $p) {
                    $stmt = $pdo->prepare("INSERT INTO TB_ACCOUNT_REQUESTS (REQUEST_ID, USERNAME, PASSWORD, FULL_NAME, ROLE, STATUS, REQUEST_DATE) VALUES (?, ?, ?, ?, ?, 'Pending', ?)");
                    $reqDate = isset($p['requestedAt']) ? date('Y-m-d H:i:s', strtotime($p['requestedAt'])) : date('Y-m-d H:i:s');
                    $stmt->execute([$p['requestId'], $p['username'], $p['password'], $p['fullName'], $p['role'], $reqDate]);
                }
            }

            foreach ($backupData['products'] as $p) {
                $stmt = $pdo->prepare("INSERT INTO TB_PRODUCTS (PRODUCT_ID, PRODUCT_NAME, CATEGORY_ID) VALUES (?, ?, ?)");
                $stmt->execute([$p['id'], $p['name'], $p['categoryId']]);
                foreach ($p['variants'] as $v) {
                    insertProductVariant($pdo, $v['id'], $p['id'], $v['name'], $v['unitPrice'], $v['stockQuantity'], $v['unitOfMeasure'], $v['reorderPoint']);
                }
            }

            if (isset($backupData['transactions'])) {
                foreach ($backupData['transactions'] as $t) {
                    $stmt = $pdo->prepare("INSERT INTO TB_TRANSACTIONS (TRANSACTION_ID, TRANSACTION_DATE, TOTAL_AMOUNT, PAYMENT_METHOD, USER_ID, CLERK_NAME) VALUES (?, ?, ?, ?, ?, ?)");
                    $txDate = date('Y-m-d H:i:s', strtotime($t['date']));
                    $stmt->execute([$t['id'], $txDate, $t['totalAmount'], $t['paymentMethod'] ?? 'Cash', $t['userId'], $t['clerkName']]);

                    foreach ($t['items'] as $item) {
                        $itemStmt = $pdo->prepare("INSERT INTO TB_TRANSACTION_ITEMS (TRANSACTION_ID, VARIANT_ID, QUANTITY, PRICE_AT_SALE) VALUES (?, ?, ?, ?)");
                        $itemStmt->execute([$t['id'], $item['variantId'], $item['quantity'], $item['priceAtSale']]);
                    }
                }
            }

            if (isset($backupData['stockInLogs'])) {
                foreach ($backupData['stockInLogs'] as $l) {
                    $stmt = $pdo->prepare("INSERT INTO TB_STOCKIN_LOGS (LOG_ID, VARIANT_ID, QUANTITY_ADDED, DATE_LOGGED, USER_ID, USER_NAME) VALUES (?, ?, ?, ?, ?, ?)");
                    $logDate = date('Y-m-d H:i:s', strtotime($l['date']));
                    $stmt->execute([$l['id'], $l['variantId'], $l['quantityAdded'], $logDate, $l['userId'], $l['userName']]);
                }
            }

            $pdo->commit();
            echo json_encode(["status" => "success", "message" => "Database backup restored successfully."]);
            break;

        default:
            echo json_encode(["status" => "error", "message" => "Unknown action: " . $action]);
            break;
    }
} catch (Exception $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
