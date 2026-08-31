import os
import sys
from pydrive2.auth import GoogleAuth
from pydrive2.drive import GoogleDrive

def generar_token():
    print("=" * 60)
    print("AUTENTICACIÓN OAUTH PARA GOOGLE DRIVE (aasapgp@gmail.com)")
    print("=" * 60)
    print("Se abrirá una ventana en tu navegador web.")
    print("Por favor, inicia sesión con la cuenta: aasapgp@gmail.com")
    print("y concede los permisos de Google Drive.")
    print("-" * 60)

    # Eliminar credenciales viejas si existen para forzar login limpio
    if os.path.exists("mycreds.txt"):
        try:
            os.remove("mycreds.txt")
        except Exception:
            pass

    gauth = GoogleAuth(settings_file="settings.yaml")
    gauth.LocalWebserverAuth()
    gauth.SaveCredentialsFile("mycreds.txt")

    print("\n¡Autenticación completada con éxito!")
    print("Credenciales guardadas en 'mycreds.txt'.")
    
    # Probar subida de verificación
    print("\nVerificando subida de prueba con la cuenta autenticada...")
    drive = GoogleDrive(gauth)
    test_file = drive.CreateFile({'title': 'test_verificacion_agente.txt'})
    test_file.SetContentString("Prueba de conexion exitosa para Agente Inspector.")
    test_file.Upload()
    print(f"Archivo de prueba subido exitosamente a Drive (ID: {test_file['id']}).")
    print("Eliminando archivo de prueba...")
    test_file.Delete()
    print("¡Verificación 100% exitosa!")
    print("=" * 60)

if __name__ == "__main__":
    generar_token()
