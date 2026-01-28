"""
ZAFESYS Suite - Legal Pages (Privacy Policy, Terms)
"""
from fastapi import APIRouter
from fastapi.responses import HTMLResponse

router = APIRouter()


PRIVACY_POLICY_HTML = """
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Política de Privacidad - ZAFESYS</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6;
            color: #333;
            background: #f5f5f5;
            padding: 20px;
        }
        .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 40px;
            border-radius: 12px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
        }
        h1 {
            color: #0891b2;
            margin-bottom: 10px;
        }
        .subtitle {
            color: #666;
            margin-bottom: 30px;
            font-size: 14px;
        }
        h2 {
            color: #1f2937;
            margin: 25px 0 15px;
            font-size: 18px;
        }
        p, li {
            margin-bottom: 10px;
            color: #4b5563;
        }
        ul {
            margin-left: 20px;
            margin-bottom: 15px;
        }
        .contact {
            background: #f0f9ff;
            padding: 20px;
            border-radius: 8px;
            margin-top: 30px;
        }
        .contact a {
            color: #0891b2;
            text-decoration: none;
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e5e7eb;
            font-size: 12px;
            color: #9ca3af;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>Política de Privacidad</h1>
        <p class="subtitle">ZAFESYS - Aplicaciones Móviles (Instaladores y Bodega)</p>

        <p><strong>Última actualización:</strong> Enero 2025</p>

        <h2>1. Introducción</h2>
        <p>
            Las aplicaciones móviles de ZAFESYS (ZAFESYS Instaladores y ZAFESYS Bodega) son
            herramientas de uso interno exclusivo para empleados de ZAFESYS. Esta política
            describe cómo recopilamos, usamos y protegemos la información de nuestros empleados.
        </p>

        <h2>2. Información que Recopilamos</h2>
        <p>Recopilamos la siguiente información únicamente para fines laborales:</p>
        <ul>
            <li><strong>Nombre completo:</strong> Para identificación del empleado en el sistema.</li>
            <li><strong>Correo electrónico:</strong> Para comunicaciones relacionadas con el trabajo.</li>
            <li><strong>Ubicación (GPS):</strong> Solo durante el horario laboral para coordinar
                instalaciones y entregas. No se rastrea fuera del horario de trabajo.</li>
            <li><strong>Información de tareas:</strong> Registros de instalaciones, entregas y
                actividades laborales realizadas.</li>
        </ul>

        <h2>3. Uso de la Información</h2>
        <p>La información recopilada se utiliza exclusivamente para:</p>
        <ul>
            <li>Coordinar y asignar tareas de instalación y bodega.</li>
            <li>Optimizar rutas y tiempos de entrega.</li>
            <li>Generar reportes internos de productividad.</li>
            <li>Comunicación entre empleados y supervisores.</li>
        </ul>

        <h2>4. Compartir Información</h2>
        <p>
            <strong>No compartimos información personal con terceros.</strong> Los datos son
            de uso exclusivo interno de ZAFESYS y solo pueden ser accedidos por personal
            autorizado (supervisores y administradores).
        </p>

        <h2>5. Almacenamiento y Seguridad</h2>
        <p>
            Todos los datos se almacenan en servidores seguros con encriptación. Implementamos
            medidas de seguridad técnicas y organizativas para proteger la información contra
            acceso no autorizado, pérdida o alteración.
        </p>

        <h2>6. Retención de Datos</h2>
        <p>
            Los datos se conservan mientras el empleado mantenga su relación laboral con ZAFESYS.
            Al finalizar la relación laboral, los datos personales se eliminan en un plazo
            razonable, conservando únicamente los registros requeridos por ley.
        </p>

        <h2>7. Derechos del Usuario</h2>
        <p>Como empleado, tienes derecho a:</p>
        <ul>
            <li>Acceder a tu información personal almacenada.</li>
            <li>Solicitar corrección de datos inexactos.</li>
            <li>Solicitar información sobre el uso de tus datos.</li>
        </ul>

        <h2>8. Cambios a esta Política</h2>
        <p>
            Podemos actualizar esta política ocasionalmente. Los cambios significativos serán
            comunicados a través de los canales internos de la empresa.
        </p>

        <div class="contact">
            <h2>9. Contacto</h2>
            <p>
                Para preguntas sobre esta política de privacidad o el manejo de tus datos,
                contacta a:
            </p>
            <p>
                <strong>ZAFESYS</strong><br>
                Email: <a href="mailto:andresestradaco@gmail.com">andresestradaco@gmail.com</a>
            </p>
        </div>

        <div class="footer">
            <p>&copy; 2025 ZAFESYS. Todos los derechos reservados.</p>
        </div>
    </div>
</body>
</html>
"""


@router.get("/privacy-policy", response_class=HTMLResponse)
async def get_privacy_policy():
    """
    Returns the privacy policy page for ZAFESYS mobile apps.
    Required for Google Play Store compliance.
    """
    return HTMLResponse(content=PRIVACY_POLICY_HTML)
