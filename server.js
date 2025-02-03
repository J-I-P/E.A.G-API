const jsonServer = require('json-server')
// const clone = require('clone')
// const data = require('./db.json')
const fs = require('fs')
const path = require('path')
const axios = require("axios");

const paginate = require('./middlewares/paginate.js'); 

const express = require('express');

const ECOIN_PER_DRAW = 30


const isProductionEnv = process.env.NODE_ENV === 'production';
// const server = jsonServer.create()
const server = express();
server.use(express.json());

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

// // 在路由處理之前添加中間件
// server.use((req, res, next) => {
//   if (req.method === 'POST' || req.method === 'PUT' || req.method === 'PATCH') {
//       if (req.body && req.body.userId) {
//           req.body.userId = parseInt(req.body.userId, 10); // 確保 userId 為數字
//       }
//   }
//   next();
// });


server.post('/api/users/:userId/favorites', (req, res) => {
	try {
			const db = router.db; 
			const userId = parseInt(req.params.userId, 10);
			const { exhibitionId } = req.body;

			if (!exhibitionId) {
					return res.status(400).json({ error: 'Exhibition ID is required' });
			}

		const existingFavorite = db.get('favorites').find({ userId, exhibitionId }).value();

		let newFavorite;

		if (existingFavorite) {
			newFavorite = existingFavorite;
		} else {
			const favorite = { userId, exhibitionId };
			newFavorite = db.get('favorites').insert(favorite).write();
		}

		res.status(201).json(newFavorite);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'An error occurred' });
	}
});

server.get('/api/users/:userId/favorites', (req, res) => {
	const userId = req.params.userId.toString();
	const db = router.db;

	const favorites = db
			.get('favorites')
			.filter(fav => fav.userId.toString() === userId && fav.exhibitionId)
			.value();

	const exhibitions = db.get('exhibitions').value();


	const result = favorites.map(fav => {
			const exhibition = exhibitions.find(ex => ex.id === fav.exhibitionId);
			return {
					...fav,
					exhibition: exhibition || null 
			};
	});

	res.json(result);
});


server.get('/api/exhibitions', paginate, (req, res) => {
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

	if (req.query.exhibitions_categoriesId) {
			exhibitions = exhibitions.filter(exhibition =>
					exhibition.exhibitions_categoriesId === Number(req.query.exhibitions_categoriesId)
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

    if (req.query.startDate || req.query.endDate) {
        const startDate = req.query.startDate ? new Date(req.query.startDate) : null;
        const endDate = req.query.endDate ? new Date(req.query.endDate) : null;

        exhibitions = exhibitions.filter(exhibition => {
            const exhibitionStartDate = new Date(exhibition.start_date);
            const exhibitionEndDate = new Date(exhibition.end_date);

            const isOverlapping =
                (!startDate || exhibitionEndDate >= startDate) &&
                (!endDate || exhibitionStartDate <= endDate);

            return isOverlapping;
        });
    }

    if (req.query.search) {
        const searchQuery = req.query.search; 
        console.log(searchQuery); 
        exhibitions = exhibitions.filter(exhibition =>
            exhibition.title.includes(searchQuery) || 
            exhibition.description.includes(searchQuery) 
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

	const { startIndex, endIndex } = req.locals.pagination;
	const paginatedExhibitions = exhibitions.slice(startIndex, endIndex);

	const total = exhibitions.length;
	const totalPages = Math.ceil(total / req.locals.pagination.limit);

	res.json({
			data: paginatedExhibitions,
			meta: {
					...req.locals.meta,
					total,
					totalPages,
			},
	});
});


server.post("/api/draw", async (req, res) => {
	const { count, userId } = req.body; 
	const prizesWon = [];
  
	try {

	  if (isNaN(count) || count < 1) {
		return res.status(400).json({ message: "請提供有效的抽獎次數" });
	  }
  

		const userResponse = await axios.get(`http://localhost:3000/users/${userId}`);
		const user = userResponse.data;
		if (!user) {
			return res.status(404).json({ message: "使用者未找到" });
		}
  
		const userTokens = user.e_coin;


		const totalTokensNeeded = count * ECOIN_PER_DRAW;
		if (userTokens < totalTokensNeeded) {
		  return res.status(400).json({ message: `你的代幣不足，最多只能抽 ${Math.floor(userTokens / ECOIN_PER_DRAW)} 次。` });
		}

		const drawLimit = Math.min(count, Math.floor(userTokens / ECOIN_PER_DRAW));
	
	  console.log("drawLimit:", drawLimit);
  

	  const response = await axios.get("http://localhost:3000/gotcha_goods");
	  let prizes = response.data.filter((prize) => prize.stock > 0);
  
	  if (prizes.length === 0) {
		return res.status(400).json({ message: "所有獎品都已經抽完！" });
	  }
  
	  // 抽獎過程
	  for (let i = 0; i < drawLimit; i++) {
		// 隨機抽取一個獎品
		const selectedPrize = prizes[Math.floor(Math.random() * prizes.length)];
  
		// 更新庫存
		await axios.patch(`http://localhost:3000/gotcha_goods/${selectedPrize.id}`, {
		  stock: selectedPrize.stock - 1,
		});
  
		prizesWon.push(selectedPrize);
	  }

  const updatedTokens = userTokens - totalTokensNeeded;
  await axios.patch(`http://localhost:3000/users/${userId}`, {
	e_coin: updatedTokens,
  });


  const prizeSummary = prizesWon.reduce((summary, prize) => {
	const prizeName = prize.name;
	if (summary[prizeName]) {
	  summary[prizeName] += 1;
	} else {
	  summary[prizeName] = 1;
	}
	return summary;
  }, {});

  res.json({
	message: `抽獎完成！你總共抽中 ${drawLimit} 次`,
	prizeSummary: prizeSummary, 
	remainingTokens: updatedTokens, 
  });
	} catch (error) {
	  res.status(500).json({ message: "抽獎失敗", error: error.message });
	}
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