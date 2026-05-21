# Инструкция по деплою Alena Bot & Web Panel в продакшн

Эта инструкция содержит подробное руководство по безопасности, настройке системной службы `systemd`, работе с веб-сервером `Caddy` (для работы нескольких сайтов и ботов на одном сервере совместно с Docker/AmneziaVPN) и безопасному хэшированию пароля администратора.

Целевая папка проекта на сервере: `/root/prod/AlenaBot`

---

## 🔐 1. Настройка секретов через `.env` (Безопасный подход)

Секреты **никогда** не должны лежать в файле службы `systemd` в открытом виде. Вместо этого они хранятся в защищенном локальном файле `.env` в корне проекта.

*Внимание: В Vite v6 не рекомендуется задавать `NODE_ENV=production` непосредственно в файле `.env` во время сборки фронтенда, чтобы избежать системных конфликтов. Задавайте его на уровне окружения в системной службе.*

Создайте файл `.env` в корне проекта на сервере (`/root/prod/AlenaBot/.env`):

```env
# Порт приложения
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

Файл службы `systemd` безопасно загружает все секреты из внешнего `.env` файла с помощью директивы `EnvironmentFile`. Таким образом, исходный код службы не раскроет пароли или токены. Мы также явно указываем `Environment=NODE_ENV=production` прямо в службе.

Создайте или отредактируйте `/etc/systemd/system/AlenaBot.service`:

```ini
[Unit]
Description=Alena Telegram Bot & Web Admin Panel
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/root/prod/AlenaBot

# Явное указание продакшн-режима запуска
Environment=NODE_ENV=production

# Безопасная загрузка переменных окружения из .env файла
EnvironmentFile=/root/prod/AlenaBot/.env

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
6. Откройте `.env` файл на сервере (`nano /root/prod/AlenaBot/.env`), вставьте эти две строки, а строку `ADMIN_PASSWORD="..."` **полностью удалите**.
7. Перезапустите службу: `systemctl restart AlenaBot`.
   *Теперь сервер проверяет пароли только по хэшу и соли, используя криптографические функции сравнения с защитой от тайминг-атак. Пароль в открытом виде отсутствует на сервере.*

---

## 🌐 4. Настройка Caddy на порт 8443 для поддомена (Например, admin.alenabot.mak-o.ru)

Если при переходе по ссылке вида `https://alenabot.mak-o.ru:8443` или `https://admin.alenabot.mak-o.ru:8443` вы получаете ошибку **`ERR_SSL_PROTOCOL_ERROR`**, это означает, что Caddy **не смог выпустить SSL-сертификат** для этого домена. 

### Почему это происходит?
1. **Отсутствует A-запись в DNS:** Если домен/поддомен не направлен на IP-адрес вашего сервера (в логах была ошибка `Failed to resolve host: Name or service not known`), Let's Encrypt не может подтвердить владение доменом.
2. **Проксирование через Cloudflare:** Если домен обслуживается Cloudflare и включена оранжевая туча (Proxy), Let's Encrypt не может пройти HTTP-01 проверку на порту `80`.
3. **Порт 80 всё ещё закрыт или занят:** Если на сервере фаервол блокирует порт `80` или на нём работает другой софт.

---

### Решение: Настройка поддомена `admin.alenabot.mak-o.ru`

Использование отдельного выделенного поддомена — отличная идея! Вот пошаговая инструкция по его полной настройке:

#### Шаг 1. Создание DNS-записи
Зайдите в панель вашего DNS-провайдера (например, Cloudflare) и добавьте новую **A-запись**:
* **Name (Имя):** `admin.alenabot` (или `admin` — смотря как настроена зона)
* **IPv4 address (IP-адрес):** IP вашего сервера (`vm816838`)
* **Proxy status (Статус прокси):** 
  * *Рекомендуется:* **DNS-only (Серая туча 🔘)** — если хотите, чтобы Caddy сам получал сертификат у Let's Encrypt.
  * Режим **Proxied (Оранжевая туча 🟠)** — если вы хотите использовать защиту Cloudflare (в этом случае используйте способ с `tls internal` ниже).

---

#### Шаг 2. Настройка Caddyfile (`/etc/caddy/Caddyfile`)

Откройте ваш Caddyfile:
```bash
sudo nano /etc/caddy/Caddyfile
```

Выберите один из двух вариантов ниже в зависимости от вашей DNS-настройки:

##### Вариант А. Вы используете DNS-only (Серая туча 🔘 в Cloudflare или другой провайдер)
*Caddy сам получит полноценный SSL-сертификат у Let's Encrypt через порт 80.*

```caddy
{
    # Указываем альтернативный порт для HTTPS (так как 443 занят VPN)
    https_port 8443
}

# Поддомен админки на порту 8443
admin.alenabot.mak-o.ru {
    # Проксирование запросов на наш локальный порт приложения Node.js
    reverse_proxy localhost:3000

    encode gzip zstd
    log {
        output file /var/log/caddy/alena_admin_access.log
    }
}
```

##### Вариант Б. Домен проксируется через Cloudflare (Оранжевая туча 🟠) — РЕКОМЕНДУЕМЫЙ ДЛЯ VPN
*Этот способ идеален, так как решает проблемы с сетевыми портами факультативно. В настройках Cloudflare SSL/TLS выберите режим **"Full"** (Не Strict!). Caddy сгенерирует самоподписанный SSL-сертификат локально, а Cloudflare на внешнем контуре предоставит идеальный SSL в браузер.*

```caddy
{
    https_port 8443
}

admin.alenabot.mak-o.ru {
    # Локальный самоподписанный сертификат Caddy, принимаемый Cloudflare Full
    tls internal

    reverse_proxy localhost:3000

    encode gzip zstd
    log {
        output file /var/log/caddy/alena_admin_access.log
    }
}
```

---

#### Шаг 3. Применение конфигурации Caddy
Перезапустите Caddy, чтобы применить конфигурацию:
```bash
sudo systemctl restart caddy
sudo systemctl status caddy
```

---

#### Шаг 4. Обновление `.env` файла вашего бота
Нам нужно указать боту его новый точный адрес для корректного отображения ссылок и (по желанию) работы вебхуков.

Откройте файл конфигурации:
```bash
sudo nano /root/prod/AlenaBot/.env
```

Отредактируйте переменную `APP_URL`, указав ваш новый точный поддомен вместе с портом `8443`:
```env
APP_URL="https://admin.alenabot.mak-o.ru:8443"
```

Перезапустите бота, чтобы обновились его внутренние параметры:
```bash
sudo systemctl restart AlenaBot
```

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
cd /root/prod/AlenaBot

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
