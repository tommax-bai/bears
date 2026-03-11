# Python 项目部署指南（本地 + 云服务器，非 Docker）

本文提供两部分内容：

1. **本地部署（开发/联调）**：适合你在自己电脑先跑起来。
2. **云服务器部署（生产）**：适合上线到 Ubuntu 服务器。

适用范围：Flask / FastAPI / Django 等常见 Python Web 项目。

---

## A. 本地部署（你现在最需要的）

> 以下步骤默认你在 Linux / macOS 终端；Windows 可用 PowerShell（下文附命令）。

## A1. 准备环境

先确认 Python 版本：

```bash
python3 --version
```

建议 Python 3.10+。

## A2. 获取代码

如果你还没克隆仓库：

```bash
git clone <你的仓库地址> app
cd app
```

如果你已经在项目目录，直接 `cd` 到项目根目录即可。

## A3. 创建并激活虚拟环境

### Linux / macOS

```bash
python3 -m venv .venv
source .venv/bin/activate
```

### Windows PowerShell

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
```

激活成功后，命令行前一般会出现 `(.venv)`。

## A4. 安装依赖

```bash
python -m pip install --upgrade pip
pip install -r requirements.txt
```

如果项目有开发依赖文件（比如 `requirements-dev.txt`），可额外执行：

```bash
pip install -r requirements-dev.txt
```

## A5. 配置环境变量

如果项目有 `.env.example`：

```bash
cp .env.example .env
```

然后按实际情况填写 `.env`（数据库地址、密钥、第三方 API Key 等）。

## A6. 启动项目（按框架选择）

### Flask

```bash
export FLASK_APP=app.py
flask run --host 127.0.0.1 --port 8000
```

### FastAPI

```bash
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

### Django

```bash
python manage.py migrate
python manage.py runserver 127.0.0.1:8000
```

启动后浏览器访问：`http://127.0.0.1:8000`

## A7. 本地常见问题排查

```bash
# 看依赖是否安装正确
pip list

# 查看端口占用（Linux/macOS）
lsof -i :8000

# 快速验证服务可达
curl -I http://127.0.0.1:8000
```

如果端口冲突，把 `8000` 改成别的（如 `8001`）。

---

## B. 云服务器部署（生产，非 Docker）

## B1. 服务器准备

以 Ubuntu 为例：

```bash
sudo apt update
sudo apt install -y python3 python3-venv python3-pip nginx git
```

建议使用普通用户部署（不要直接用 root 运行应用）。

## B2. 拉取代码并创建虚拟环境

```bash
git clone <你的仓库地址> app
cd app
python3 -m venv .venv
source .venv/bin/activate
pip install --upgrade pip
pip install -r requirements.txt
```

## B3. 约定应用启动入口

请根据框架选择一个 WSGI/ASGI 入口：

- Flask：`module:app`（例如 `app:app`）
- FastAPI：`module:app`（例如 `main:app`）
- Django：`project.wsgi:application`

## B4. 使用 Gunicorn 启动（后台服务前先验证）

```bash
# Flask / Django（WSGI）
gunicorn -w 2 -b 127.0.0.1:8000 app:app

# FastAPI（ASGI）
gunicorn -w 2 -k uvicorn.workers.UvicornWorker -b 127.0.0.1:8000 main:app
```

如能正常访问 `http://127.0.0.1:8000`，说明应用启动无误。

## B5. 配置 systemd 守护进程（推荐）

创建 `/etc/systemd/system/python-app.service`：

```ini
[Unit]
Description=Python App Service
After=network.target

[Service]
User=<你的用户名>
Group=www-data
WorkingDirectory=/home/<你的用户名>/app
Environment="PATH=/home/<你的用户名>/app/.venv/bin"
ExecStart=/home/<你的用户名>/app/.venv/bin/gunicorn -w 2 -b 127.0.0.1:8000 app:app
Restart=always

[Install]
WantedBy=multi-user.target
```

启动并设置开机自启：

```bash
sudo systemctl daemon-reload
sudo systemctl enable python-app
sudo systemctl start python-app
sudo systemctl status python-app
```

## B6. 配置 Nginx 反向代理

创建 `/etc/nginx/sites-available/python-app`：

```nginx
server {
    listen 80;
    server_name <你的域名或服务器IP>;

    location / {
        proxy_pass http://127.0.0.1:8000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用站点并重载：

```bash
sudo ln -s /etc/nginx/sites-available/python-app /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## B7. HTTPS（推荐）

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d <你的域名>
```

> 如果当前只有 IP 没有域名，可先用 HTTP 联通验证，后续绑定域名再启用 HTTPS。

## B8. 发布更新流程（最简）

```bash
cd /home/<你的用户名>/app
git pull
source .venv/bin/activate
pip install -r requirements.txt
sudo systemctl restart python-app
```

## B9. 常见排查命令

```bash
sudo systemctl status python-app
sudo journalctl -u python-app -n 200 --no-pager
sudo nginx -t
sudo tail -n 200 /var/log/nginx/error.log
```

---

## C. 你当前仓库还需补齐的最小文件

为了按本指南直接部署，你的仓库至少应包含：

- `requirements.txt`
- 应用入口文件（如 `app.py` / `main.py`）
- （可选但强烈建议）`.env.example`
- （可选）`README.md` 中的本地启动说明

