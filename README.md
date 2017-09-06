# InputTable

Install and run
```bash
npm install
node server.js
```

Add/edit a `config.json` file in `config/` folder like this
```js
{
    "user": "example_user",
    "password": "example_password",
    "server": "EXAMPLE_SERVER",
    "database": "example_db",
    "port": 1433,
    "options":
    {
        "instanceName": "EXAMPLE_INSTANCENAME"
    }
}
```

Add a key
```bash
node add_key_on_field.js apple 2017-06
```

Lock field
```bash
node lock_field.js 2017-06
```

Open (create new) field
```bash
node open_field.js 2017-06
```
