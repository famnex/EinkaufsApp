---
description: How to update and deploy the application on the server
---

# Deployment Workflow

Follow these steps to update your server with the latest changes from GitHub.

### 1. Update Code
Fetch and merge the latest changes from the main branch.
```bash
git pull origin main
```

### 2. Update Dependencies
Install any new packages that might have been added.
```bash
# In the root directory
npm install

# Update client dependencies
cd client
npm install
cd ..

# Update server dependencies
cd server
npm install
cd ..
```

### 3. Build Client (Production)
If you are serving the frontend as a static build through the Express server, you must rebuild it.
```bash
cd client
npm run build
cd ..
```

### 4. Verify Environment Variables
Ensure your `server/.env` is up to date based on `server/.env.example`.
```bash
# Check if new variables are needed
cat server/.env.example
# Edit your .env if necessary
nano server/.env
```

### 5. Restart Server
Restart your Node processes.
```bash
# If using PM2
pm2 restart all

# Or if running manually, kill and restart
```

## Uberspace Specifics (Permanent Service)

Uberspace 7 uses `supervisord` to manage permanent services.

### 1. Choose a Port
Uberspace requires a free port between 1024 and 65535.
```bash
# Find a random free port
python3 -c 'import socket; s=socket.socket(); s.bind(("", 0)); print(s.getsockname()[1]); s.close()'
```
*Note the port number (e.g., 5005).*

### 2. Configure Web Backend
Route traffic from your domain to the server port.
```bash
uberspace web backend set /EinkaufsApp --http --port 5005
```

### 3. Create Service Configuration
Create a file at `~/etc/services.d/einkaufsapp.ini` (replace `USER` and `PORT`):
```ini
[program:einkaufsapp]
directory=/home/USER/EinkaufsApp/server
command=node index.js
autostart=true
autorestart=true
environment=PORT="5005",NODE_ENV="production"
stderr_logfile=/home/USER/logs/einkaufsapp.err.log
stdout_logfile=/home/USER/logs/einkaufsapp.out.log
```

### 4. Start the Service
```bash
supervisorctl reread
supervisorctl update
supervisorctl status einkaufsapp
```
