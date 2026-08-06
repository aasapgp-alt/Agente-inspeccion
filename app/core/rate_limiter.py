import time
from collections import defaultdict
from typing import Dict, List
from fastapi import HTTPException, Request, status

class SimpleRateLimiter:
    """
    Limitador de tasa (Rate Limiter) en memoria usando una ventana deslizante de tiempo.
    Ideal para protecciones locales y servicios sin necesidad de Redis externo.
    """
    def __init__(self, requests_limit: int, window_seconds: int):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        self.history: Dict[str, List[float]] = defaultdict(list)

    def check(self, key: str):
        now = time.time()
        cutoff = now - self.window_seconds
        
        # Limpiar registros antiguos fuera de la ventana
        timestamps = [t for t in self.history[key] if t > cutoff]
        
        if len(timestamps) >= self.requests_limit:
            retry_after = int(self.window_seconds - (now - timestamps[0]))
            raise HTTPException(
                status_code=status.HTTP_429_TOO_MANY_REQUESTS,
                detail=f"Demasiadas solicitudes. Intente nuevamente en {max(1, retry_after)} segundos.",
                headers={"Retry-After": str(max(1, retry_after))}
            )
            
        timestamps.append(now)
        self.history[key] = timestamps

# Instancias predefinidas para autenticación e IA
login_rate_limiter = SimpleRateLimiter(requests_limit=10, window_seconds=60)      # 10 intentos por minuto por IP
ia_analizar_rate_limiter = SimpleRateLimiter(requests_limit=20, window_seconds=60)  # 20 análisis por minuto por usuario
