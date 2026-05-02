<?php

require_once __DIR__ . '/env.php';

define('DB_HOST', getenv_config('DB_HOST'));
define('DB_USER', getenv_config('DB_USER'));
define('DB_PASS', getenv_config('DB_PASS'));

class Conexion extends PDO {
    
    private $charset = 'utf8';
    public $nombreBd;

    public function __construct($bd = null) {
        
        $bd = $bd ?? 'geolocalizacion';        
        $this->nombreBd = $bd;
        
        try {
            parent::__construct(
                'mysql:host=' . DB_HOST . ';dbname=' . $this->nombreBd . ';charset=' . $this->charset, 
                DB_USER, 
                DB_PASS, 
                array(PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION)
            );
        } 
        catch (PDOException $e) {
            echo 'Error base: ' . $e->getMessage();
            exit;
        }
    }
}

?>