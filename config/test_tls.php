<?php

$host = "redis-13689.crce196.sa-east-1-2.ec2.cloud.redislabs.com";
$port = 13689;

$ctx = stream_context_create([
  'ssl' => [
    'verify_peer' => false,
    'verify_peer_name' => false,
  ]
]);

$fp = @stream_socket_client("tls://$host:$port", $errno, $errstr, 5, STREAM_CLIENT_CONNECT, $ctx);

if (!$fp) {
    echo "ERROR TLS: $errstr ($errno)";
} else {
    echo "TLS OK";
    fclose($fp);
}