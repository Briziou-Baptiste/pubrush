import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

# Load variables with standard default values
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM = os.getenv("SMTP_FROM", SMTP_USER or "noreply@pubrush.com")

def send_reset_code_email(to_email: str, code: str) -> bool:
    # If no SMTP_USER is set, we print a warning and log to console for development
    if not SMTP_USER or not SMTP_PASSWORD:
        print("\n" + "!"*60)
        print("⚠️  [EMAIL SERVICE] SMTP_USER ou SMTP_PASSWORD non configuré !")
        print("Veuillez configurer ces variables d'environnement dans le fichier backend/.env")
        print(f"Code de secours généré pour {to_email} : {code}")
        print("!"*60 + "\n")
        return False

    try:
        # Create message container
        msg = MIMEMultipart()
        msg['From'] = SMTP_FROM
        msg['To'] = to_email
        msg['Subject'] = "Réinitialisation de votre mot de passe - PubRush"

        # Create HTML email body
        html_body = f"""
        <html>
            <body style="font-family: Arial, sans-serif; color: #333; line-height: 1.6;">
                <div style="max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e5e7eb; border-radius: 12px; background-color: #ffffff;">
                    <h2 style="color: #111827; margin-bottom: 16px;">Bonjour,</h2>
                    <p style="font-size: 15px;">Vous avez demandé la réinitialisation du mot de passe de votre compte <strong>PubRush</strong>.</p>
                    <p style="font-size: 15px;">Voici votre code de validation unique (valide pendant 15 minutes) :</p>
                    
                    <div style="margin: 24px 0; text-align: center;">
                        <span style="display: inline-block; padding: 12px 24px; font-size: 28px; font-weight: 800; color: #2563EB; background-color: #EFF6FF; border: 1px dashed #BFDBFE; border-radius: 8px; letter-spacing: 2px;">
                            {code}
                        </span>
                    </div>
                    
                    <p style="font-size: 14px; color: #6B7280;">Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer cet email en toute sécurité.</p>
                    <hr style="border: 0; border-top: 1px solid #E5E7EB; margin: 24px 0;" />
                    <p style="font-size: 12px; color: #9CA3AF; text-align: center;">L'équipe PubRush</p>
                </div>
            </body>
        </html>
        """

        msg.attach(MIMEText(html_body, 'html'))

        # Connect to SMTP server
        server = smtplib.SMTP(SMTP_HOST, SMTP_PORT)
        server.starttls() # Enable security
        server.login(SMTP_USER, SMTP_PASSWORD)
        server.sendmail(SMTP_FROM, to_email, msg.as_string())
        server.quit()
        return True
    except Exception as e:
        print(f"\n❌ [EMAIL SERVICE ERROR] Impossible d'envoyer l'email : {e}")
        print(f"Code de secours généré pour {to_email} : {code}\n")
        return False
