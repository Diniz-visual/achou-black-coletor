<?php
// Exemplo opcional: publicar como public_html/api/receber-coleta.php
// Crie a variavel ACHOU_TOKEN no ambiente PHP ou configure o token fora da pasta publica.
header('Content-Type: application/json; charset=utf-8');
if ($_SERVER['REQUEST_METHOD'] !== 'POST') { http_response_code(405); echo json_encode(['error'=>'Metodo nao permitido']); exit; }
$secret = getenv('ACHOU_TOKEN');
$auth = $_SERVER['HTTP_AUTHORIZATION'] ?? '';
if (!$secret || !hash_equals('Bearer ' . $secret, $auth)) { http_response_code(401); echo json_encode(['error'=>'Nao autorizado']); exit; }
$body = file_get_contents('php://input', false, null, 0, 2000000);
$data = json_decode($body, true);
if (!is_array($data) || !isset($data['pages']) || !is_array($data['pages']) || count($data['pages']) > 50) { http_response_code(400); echo json_encode(['error'=>'JSON invalido']); exit; }
// Grava fora de public_html; nao publica o JSON nem altera o banco do Achou Black.
$dir = dirname(__DIR__, 2) . '/achou-black-data';
if (!is_dir($dir) && !mkdir($dir, 0700, true)) { http_response_code(500); exit; }
$file = $dir . '/ultima-coleta.json';
if (file_put_contents($file, json_encode($data, JSON_UNESCAPED_UNICODE|JSON_PRETTY_PRINT), LOCK_EX) === false) { http_response_code(500); exit; }
echo json_encode(['ok'=>true, 'pages'=>count($data['pages'])]);
