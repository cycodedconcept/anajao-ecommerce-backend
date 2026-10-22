"""One-time XAMPP setup. Refuses to overwrite existing local credentials.
Run: python3 scripts/provision-local.py (XAMPP root must allow local login).
"""
from pathlib import Path
import secrets
import subprocess

if Path('.env').exists():
    raise SystemExit('Refusing to overwrite .env; configure existing accounts manually.')
accounts = [('anajao_app', 'anajao_ecommerce_dev', 'SELECT, INSERT, UPDATE, DELETE'), ('anajao_migrator', 'anajao_ecommerce_dev', 'ALL PRIVILEGES'), ('anajao_test', 'anajao_ecommerce_test', 'ALL PRIVILEGES')]
passwords = {name: secrets.token_hex(24) for name, _, _ in accounts}
sql = '\n'.join(f"CREATE DATABASE IF NOT EXISTS `{db}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci; CREATE USER '{name}'@'127.0.0.1' IDENTIFIED BY '{passwords[name]}'; GRANT {grants} ON `{db}`.* TO '{name}'@'127.0.0.1';" for name, db, grants in accounts)
result = subprocess.run(['/Applications/XAMPP/xamppfiles/bin/mysql', '-h', '127.0.0.1', '-u', 'root'], input=sql, text=True, capture_output=True)
if result.returncode:
    raise SystemExit('Database provisioning failed; inspect existing users and root access. No credentials printed.')
content = Path('.env.example').read_text()
for name, password in passwords.items():
    content = content.replace(f'{name}:CHANGE_ME', f'{name}:{password}')
content = content.replace('GENERATE_64_HEX_CHARACTERS', secrets.token_hex(32))
content = content.replace('GENERATE_DIFFERENT_64_HEX_CHARACTERS', secrets.token_hex(32))
with open('.env', 'x') as output:
    output.write(content)
Path('.env').chmod(0o600)
print('Created schema-scoped accounts, dev/test databases, and private .env.')
