# Инструкция по деплою Alena Bot & Web Panel в продакшн

Эта инструкция содержит подробное руководство по безопасности, настройке системной службы `systemd`, работе с веб-сервером `Caddy` (для работы нескольких сайтов и ботов на одном сервере совместно с Docker/AmneziaVPN) и безопасному хэшированию пароля администратора.

Целевая папка проекта на сервере: `/root/prod/alena_bot`

---

## 🔐 1. Настройка секретов через `.env` (Безопасный подход)

Секреты **никогда** не должны лежать в файле службы `systemd` в открытом виде. Вместо этого они хранятся в защищенном локальном файле `.env` в корне проекта.

Создайте файл `.env` в корне проекта на сервере (`/root/prod/alena_bot/.env`):

```env
# Окружение и порт
NODE_ENV=production
PORT=3000

# Регистрация бота Telegram
TELEGRAM_BOT_TOKEN="ВАШ_TELEGRAM_БОТ_ТОКЕН"

# URL веб-панели для автоподключения вебхуков
# Например: https://alena.вашдомен.ru
APP_URL="https://ваш-домен.ru"

# Настройки авторизации в веб-панели управления
# ВНИМАНИЕ: Не пишите пароль в открытом виде! См. Раздел 3 для безопасного хэширования.
ADMIN_USERNAME="admin"

# Исходный текстовый пароль (только для первого входа, затем замените на HASH + SALT!)
ADMIN_PASSWORD="ВАШ_СЛОЖНЫЙ_ОДНОРАЗОВЫЙ_ПАРОЛЬ"
```

Установите безопасные права на файл на вашем сервере, чтобы никто кроме `root` (или запускающего пользователя) не мог его прочитать:
```bash
chmod 600 /root/prod/alena_bot/.env
```

---

## 🛠️ 2. Настройка службы `systemd` (AlenaBot.service)

Файл службы `systemd` безопасно загружает все секреты из внешнего `.env` файла с помощью директивы `EnvironmentFile`. Таким образом, исходный код службы не раскроет пароли или токены.

Создайте или отредактируйте `/etc/systemd/system/AlenaBot.service`:

```ini
[Unit]
Description=Alena Telegram Bot & Web Admin Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/prod/alena_bot

# Безопасная загрузка переменных окружения из .env файла
EnvironmentFile=/root/prod/alena_bot/.env

# Команда запуска скомпилированного бандла
ExecStart=/usr/bin/node dist/server.cjs

# Автоматический перезапуск при падении
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
```

**Команды управления службой:**
```bash
# Обновить конфигурацию systemd после изменения файла службы
systemctl daemon-reload

# Включить автозапуск при перезагрузке сервера
systemctl enable AlenaBot

# Запустить службу бота прямо сейчас
systemctl start AlenaBot

# Посмотреть текущий статус и логи работы
systemctl status AlenaBot

# Просмотр логов в реальном времени
journalctl -u AlenaBot -f -n 50
```

---

## 🧭 3. Руководство по безопасному хэшированию пароля

Чтобы полностью исключить хранение вашего пароля администратора в открытом виде даже в `.env` файле, в админ-панель встроен **криптографический инструмент шифрования (SHA-256 + Salt)**.

**Как перевести панель на хэш-авторизацию:**
1. Выполните первый вход в панель управления, используя текстовый пароль `ADMIN_PASSWORD` из `.env`.
2. В верхнем правом углу нажмите кнопку **Настройка API** (или Настройки).
3. В появившемся окне найдите раздел: **🔐 Инструмент безопасного шифрования (Хэш/Соль)**.
4. Введите ваш желаемый надежный пароль и нажмите кнопку **Получить хэш**.
5. Программа сгенерирует уникальную криптографическую соль и SHA-256 хэш. Скопируйте полученные строки. Они будут выглядеть примерно так:
   ```env
   ADMIN_PASSWORD_HASH="d033e22ae348aeb5660fc2140aec35850c4da997..."
   ADMIN_PASSWORD_SALT="f0714c330f87bdac..."
   ```
6. Откройте `.env` файл на сервере (`nano /root/prod/alena_bot/.env`), вставьте эти две строки, а строку `ADMIN_PASSWORD="..."` **полностью удалите**.
7. Перезапустите службу: `systemctl restart AlenaBot`.
   *Теперь сервер проверяет пароли только по хэшу и соли, используя криптографические функции сравнения с защитой от тайминг-атак. Пароль в открытом виде отсутствует на сервере.*

---

## 🌐 4. Настройка Caddy для нескольких сайтов, сетей и AmneziaVPN

Веб-сервер **Caddy** идеально подходит для хостинга нескольких ботов, поддоменов и сайтов. В отличие от Nginx, Caddy автоматически получает, настраивает и продлевает бесплатные SSL-сертификаты от Let's Encrypt / ZeroSSL.

### Пример Caddyfile (`/etc/caddy/Caddyfile`)

Если у вас на сервере работает `AmneziaVPN` в докер-контейнере, он обычно слушает свои порты VPN (например, WireGuard/Shadowsocks), а веб-порты `80` и `443` остаются свободными для Caddy. 

Ниже представлен пример конфигурации Caddyfile для запуска админ-панели Алёны, других ваших сайтов и ботов на одном сервере vm816838:

```caddy
# 1. Поддомен для админ-панели и вебхуков Алёны
alena.yourdomain.ru {
    # Проксируем трафик на порт 3000, где крутится наш Node.js сервер
    reverse_proxy localhost:3000

    # Сжатие трафика для ускорения загрузки
    encode gzip zstd

    # Логирование запросов в файл (для отладки)
    log {
        output file /var/log/caddy/alena_bot_access.log
    }
}

# 2. Еще один ваш сайт на этом же сервере
another-site.ru {
    # Раздача статических файлов из директории
    root * /var/www/another-site
    file_server
    encode gzip
}

# 3. Второй бот (если у него есть вебхук-интерфейс на порту 3005)
bot2.yourdomain.ru {
    reverse_proxy localhost:3005
    encode gzip
}
```

### Как применить конфигурацию Caddy:
1. Установите Caddy на Ubuntu (если он еще не установлен):
   ```bash
   sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
   curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
   sudo apt update
   sudo apt install caddy
   ```
2. Откройте конфигурационный файл: `nano /etc/caddy/Caddyfile`.
3. Запишите настройки поддоменов (заменив `yourdomain.ru` на ваш реальный зарегистрированный домен, направленный на IP вашего сервера `vm816838`).
4. Перезапустите веб-сервер:
   ```bash
   systemctl restart caddy
   ```
5. Проверьте статус сертификатов SSL:
   ```bash
   systemctl status caddy
   ```

---

## 🚀 5. Быстрый скрипт для обновления кода на сервере (CI/CD)

Чтобы обновить бота на сервере после коммита в GitHub, просто зайдите на сервер и выполните эти команды:

```bash
cd /root/prod/alena_bot

# На всякий случай сохраняем ваш .env перед пулом
cp .env .env.bak

# Скачиваем новые файлы из вашего репозитория
git pull

# Восстанавливаем .env
mv .env.bak .env

# Обновляем npm-зависимости
npm install

# Собираем клиент (Vite) и сервер (Esbuild)
npm run build

# Перезапускаем службу бота
systemctl restart AlenaBot

# Смотрим логи запуска службы
journalctl -u AlenaBot -f -n 30
```
