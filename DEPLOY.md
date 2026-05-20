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

## 🌐 4. Настройка Caddy на альтернативный порт (8443) (Совместно с VPN на 443)

Из полученных вами логов видно, что порт `80` (HTTP) на вашем сервере занят процессом `nginx`, поэтому Caddy не может запуститься и выдает ошибку:
`listen tcp :80: bind: address already in use`

Если Nginx не используется для реальных сайтов на этом сервере, **наилучшее и самое простое решение** — отключить его и полностью переключиться на **Caddy**. Это освободит порт `80` для автоматического получения и продления SSL-сертификатов Let's Encrypt!

### Шаг 1. Отключение Nginx для освобождения порта 80
Запустите следующие команды на сервере:
```bash
# Останавливаем запущенный Nginx
sudo systemctl stop nginx

# Отключаем автозапуск Nginx при перезагрузке сервера
sudo systemctl disable nginx
```

После этого порт `80` станет полностью свободен!

---

### Шаг 2. Настройка Caddyfile с поддержкой порта 8443

Так как порт `443` у вас занят VPN, мы настроим Caddy слушать HTTPS на безопасном порту `8443`. Telegram Webhook официально поддерживает входящие вебхуки на порту `8443`!

Откройте ваш Caddyfile:
```bash
sudo nano /etc/caddy/Caddyfile
```

Замените всё содержимое файла следующим конфигом:

```caddy
{
    # Указываем Caddy использовать порт 8443 для HTTPS
    # (Порт 80 будет использоваться для HTTP по умолчанию и прохождения SSL вызовов)
    https_port 8443
}

# 1. Поддомен для админ-панели и вебхуков Алёны
alena.yourdomain.ru {
    # Проксируем трафик на порт 3000, где крутится наш Node.js сервер
    reverse_proxy localhost:3000

    # Сжатие трафика для ускорения
    encode gzip zstd

    # Логирование запросов в файл (полезно при отладке)
    log {
        output file /var/log/caddy/alena_bot_access.log
    }
}
```
*(Замените `alena.yourdomain.ru` на ваш реальный поддомен, направленный на IP вашего сервера `vm816838`).*

---

### Шаг 3. Запуск и применение конфигурации Caddy
Теперь, когда порт `80` свободен, запустите и перезапустите службу Caddy:
```bash
# Перезагружаем конфиг Caddy
sudo systemctl restart caddy

# Проверяем статус работы Caddy
sudo systemctl status caddy
```
Caddy автоматически:
1. Займет порт `80` для отправки HTTP-челленджа Let's Encrypt.
2. Получит бесплатный SSL сертификат для вашего домена `alena.yourdomain.ru`.
3. Начнет принимать трафик по адресу `https://alena.yourdomain.ru:8443` и проксировать его на внутренний сервис бота (порт `3000`).

---

### Шаг 4. Альтернатива: Настройка Nginx (если Nginx вам всё-таки нужен на порту 80)

Если вы выяснили, что порт 80 на вашем сервере запущен под управлением `nginx`, просто создайте файл конфигурации для бота в Nginx:

```bash
sudo nano /etc/nginx/sites-available/alena_bot
```

Вставьте следующую конфигурацию (она будет принимать запросы на стандартном HTTPS порту `443` или альтернативном `8443` и проксировать на бота):

```nginx
server {
    listen 8443 ssl;
    server_name alena.yourdomain.ru;

    # Если сертификаты уже есть (например, сгенерированы Let's Encrypt / Certbot)
    ssl_certificate /etc/letsencrypt/live/alena.yourdomain.ru/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/alena.yourdomain.ru/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Активируйте конфиг и перезапустите Nginx:
```bash
sudo ln -s /etc/nginx/sites-available/alena_bot /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

---

## 🛠️ 5. Открытие портов в фаерволе (UFW)
Не забудьте разрешить входящий трафик на порту `8443` и `80` на вашем сервере Ubuntu:
```bash
sudo ufw allow 8443/tcp
sudo ufw allow 80/tcp
sudo ufw reload
```

---

## 🚀 6. Быстрый скрипт для обновления кода на сервере (CI/CD)

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
