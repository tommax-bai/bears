# Nutrition OpenAPI Service

用于记录用户饮食内容的 OpenAPI 风格服务（用户信息、食物信息、热量、进食时间），数据保存到 SQLite，并支持增删改查。

## 功能

- 用户接口：新增、列表
- 食物接口：新增、列表
- 饮食记录接口：新增、列表、详情、修改、删除
- OpenAPI 文档出口：`/openapi.json`

## 启动

```bash
python app/main.py
```

默认地址：`http://127.0.0.1:8000`

## 接口清单

- `GET /health`
- `GET /openapi.json`
- `POST /users`
- `GET /users`
- `POST /foods`
- `GET /foods`
- `POST /meal-records`
- `GET /meal-records`
- `GET /meal-records/{id}`
- `PUT /meal-records/{id}`
- `DELETE /meal-records/{id}`

## 数据库

- 文件：`nutrition.db`
- 表：`users`、`foods`、`meal_records`
