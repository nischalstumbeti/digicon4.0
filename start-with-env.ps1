# Start server with MongoDB env vars (use this if .env has encoding issues)
$env:MONGODB_URI = "mongodb+srv://iamkarthikeyen_db_user:diffuse007@cluster0.wysdr5q.mongodb.net/?appName=Cluster0"
$env:MONGODB_DB = "SiGBED"
node app.js
