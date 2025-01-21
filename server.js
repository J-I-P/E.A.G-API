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
  const db = router.db;
  let exhibitions = db.get('exhibitions').value();

  const queryTags = req.query.tags ? req.query.tags.split(',') : [];
  if (queryTags.length > 0) {
      exhibitions = exhibitions.filter(exhibition =>
          exhibition.tags.some(tag => queryTags.includes(tag))
      );
  }

  if (req.query.regionId) {
      exhibitions = exhibitions.filter(exhibition =>
          exhibition.regionId === Number(req.query.regionId)
      );
  }

  if (req.query.organizerId) {
      exhibitions = exhibitions.filter(exhibition =>
          exhibition.organizerId === Number(req.query.organizerId)
      );
  }

  if (req.query.featured) {
      exhibitions = exhibitions.filter(exhibition =>
          exhibition.featured === Boolean(req.query.featured)
      );
  }

  const sortKey = req.query._sort;
  const sortOrder = req.query._order === 'desc' ? -1 : 1;
  if (sortKey) {
      exhibitions = exhibitions.sort((a, b) => {
          const valueA = a[sortKey];
          const valueB = b[sortKey];
          if (valueA < valueB) return -1 * sortOrder;
          if (valueA > valueB) return 1 * sortOrder;
          return 0;
      });
  }

  const page = parseInt(req.query._page, 10) || 1;
  const limit = parseInt(req.query._limit, 10) || exhibitions.length;
  const startIndex = (page - 1) * limit;
  const endIndex = startIndex + limit;

  const paginatedExhibitions = exhibitions.slice(startIndex, endIndex);

  res.json({
      data: paginatedExhibitions,
      total: exhibitions.length,
      page,
      limit,
  });
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