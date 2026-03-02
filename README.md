IMPORTANT COMMANDS
```shell
backend server init
cd GEMINATION-institution/backend
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000
```

```shell
frotend server init
cd GEMINATION-institution
npm run dev
```

```shell
kill any current ports running
netstat -ano | findstr :port_no
taskkill /PID <PID> /F
## example : taskkill /PID 37764 /F
```
