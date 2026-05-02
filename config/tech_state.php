<?php

return [
    // stopped generado por puntos iguales o parecidos parado por semáforo o entrega muy rápida, hasta 120 seg
    
    // stopped_sec                                                               ** 0 a 120 **     < 2
    'stopped_medium_sec'  => 120, // en entrega más de 120 seg hasta 360 seg     ** 120 a 360 **   2 a 6
    'stopped_long_sec'  => 360,   // tuvo un problema más de 360 seg             ** más de 360 **  > 6
    'move_eps_meters'   => 5, 
    
    'stale_ttl_sec'     => 20,
    'no_data_ttl_sec'   => 120,
    'offline_ttl_sec'   => 360,
    
    'reset_context_sec' => 480  //18000 // 5 horas
    
];