const jsonServer = require('json-server')
const clone = require('clone')
// const data = require('./db.json')
const fs = require('fs')
const path = require('path')

const isProductionEnv = process.env.NODE_ENV === 'production';
const server = jsonServer.create()

// For mocking the POST request, POST request won't make any changes to the DB in production environment
// const router = jsonServer.router(isProductionEnv ? clone(data) : 'db.json', {
//     _isFake: isProductionEnv
// })


const filePath = path.join('db.json')
const data = fs.readFileSync(filePath, "utf-8")
const db = JSON.parse(data)


const router = jsonServer.router(db)
const middlewares = jsonServer.defaults()

server.use(middlewares)

// server.use((req, res, next) => {
//     if (req.path !== '/')
//         router.db.setState(clone(data))
//     next()
// })

const API_KEY = process.env.APIKEY;

server.use((req, res, next) => {
    const apiKey = req.headers['api-key']; 
    if (apiKey === API_KEY) {
      next(); 
    } else {
      res.status(401).json({ error: 'Unauthorized: Invalid API Key' }); 
    }
  });


server.get('/api/exhibitions', (req, res) => {
  const db = router.db; // 獲取 JSON Server 的資料庫
  const exhibitions = db.get('exhibitions').value(); // 獲取所有展覽數據
  const queryTags = req.query.tags ? req.query.tags.split(',') : []; // 解析查詢參數中的 tags，並轉為陣列

  if (queryTags.length === 0) {
      // 如果沒有提供 tags，返回所有展覽
      return res.json(exhibitions);
  }

  // 篩選包含任一查詢標籤的展覽
  const filteredExhibitions = exhibitions.filter(exhibition =>
      exhibition.tags.some(tag => queryTags.includes(tag))
  );

  res.json(filteredExhibitions);
});

server.use(jsonServer.rewriter({
    '/api/*': '/$1',
    '/blog/:resource/:id/show': '/:resource/:id'
}))

server.use(router)
server.listen(process.env.PORT || 3000, () => {
    console.log('JSON Server is running')
})

// Export the Server API
module.exports = server