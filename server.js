const jsonServer = require('json-server')
// const clone = require('clone')
// const data = require('./db.json')
const fs = require('fs')
const path = require('path')
const axios = require("axios");

const paginate = require('./middlewares/paginate.js'); 

const express = require('express');

const ECOIN_PER_DRAW = 30

let API_BASE_URL;
console.log("process.env.NODE_ENV:", process.env.NODE_ENV);
if (process.env.NODE_ENV === 'development') {
	API_BASE_URL = 'http://localhost:3000'	
}else {
	API_BASE_URL = 'https://e-a-g-api.vercel.app'
}


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

server.post('/api/login', (req, res) => {
	const { email, password } = req.body;
	console.log(email, password);
	const db = router.db;
	const user = db.get('users').find({ email, password }).value();
	if (user) {
		res.json(user);
	} else {
		res.status(401).json({ error: 'Invalid username or password' });
	}
});	

server.get('/api/users/:userId/ranking', (req, res) => {
	const userId = req.params.userId.toString();
	const db = router.db;

	const ranking = db
			.get('ranking')
			.filter(rank => rank.userId.toString() === userId && rank.exhibitionId)
			.value();

	const exhibitions = db.get('exhibitions').value();


	const result = ranking.map(rank => {
			const exhibition = exhibitions.find(ex => ex.id === rank.exhibitionId);
			return {
					...rank,
					exhibition: exhibition || null 
			};
	});

	res.json(result);
});



server.post('/api/users/:userId/favorites', (req, res) => {
	try {
			const db = router.db; 
			const userId = parseInt(req.params.userId, 10);
			const { exhibitionId } = req.body;

			if (!exhibitionId) {
					return res.status(400).json({ error: 'Exhibition ID is required' });
			}

		const existingFavorite = db.get('favorites').find({ userId, exhibitionId: Number(exhibitionId) }).value();

		let newFavorite;

		if (existingFavorite) {
			newFavorite = existingFavorite;
		} else {
			const favorite = { userId, exhibitionId: Number(exhibitionId) };
			newFavorite = db.get('favorites').insert(favorite).write();
		}

		res.status(201).json(newFavorite);
	} catch (error) {
		console.error(error);
		res.status(500).json({ error: 'An error occurred' });
	}
});

server.delete('/api/users/:userId/favorites', (req, res) => {
    try {
        const db = router.db;
        const userId = parseInt(req.params.userId, 10);
        const { exhibitionId } = req.body;

		console.log(userId, exhibitionId);

        const existingFavorite = db.get('favorites').find({ userId, exhibitionId: Number(exhibitionId) }).value();

		console.log(existingFavorite);

        if (!existingFavorite) {
			console.log("Favorite not found");
            return res.status(404).json({ error: 'Favorite not found' });
        }

        db.get('favorites').remove({ userId, exhibitionId }).write();

        res.status(200).json({ message: 'Favorite removed successfully' });
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'An error occurred' });
    }
});

// server.get('/api/users/:userId/favorites', (req, res) => {
// 	const userId = req.params.userId.toString();
// 	const db = router.db;

// 	const favorites = db
// 			.get('favorites')
// 			.filter(fav => fav.userId.toString() === userId && fav.exhibitionId)
// 			.value();

// 	const exhibitions = db.get('exhibitions').value();


// 	const result = favorites.map(fav => {
// 			const exhibition = exhibitions.find(ex => ex.id === fav.exhibitionId);
// 			return {
// 					...fav,
// 					exhibition: exhibition || null 
// 			};
// 	});

// 	res.json(result);
// });

server.get('/api/exhibitions/:exhibitionId', (req, res) => {
	const db = router.db;
	let exhibitions = db.get('exhibitions').value();
	if (req.query.userId) {
        const userId = Number(req.query.userId);
        const favorites = db.get('favorites').filter(fav => fav.userId === userId).value();

		console.log(favorites);

		console.log(`filter userId: ${req.query.userId} | ${favorites.length}`);

        exhibitions = exhibitions.map(exhibition => ({
            ...exhibition,
            isFavorite: favorites.some(fav => Number(fav.exhibitionId) === Number(exhibition.id)),
        }));

		if (req.query._expand) {
			console.log("expand");
			console.log(req.query._expand);
			const expandFields = req.query._expand.split(',');
			console.log(expandFields);
			console.log("expandFields.includes('organizers')", expandFields.includes('organizers'));
		
			if (expandFields.includes('organizers')) {
				const organizers = db.get('organizers').value();
				exhibitions.forEach(exhibition => {
					exhibition.organizer = organizers.find(org => org.id === exhibition.organizerId) || null;
				});
			}
		}

		res.json(exhibitions.find(exhibition => Number(exhibition.id) === Number(req.params.exhibitionId)));
	} else {
		res.json(db.get('exhibitions').find({ id: Number(req.params.exhibitionId) }).value());
    }
});

// server.get('/api/exhibitions/:exhibitionId', (req, res) => {
//     const db = router.db;
//     let exhibitions = db.get('exhibitions').value();
//     if (req.query.userId) {
//         const userId = Number(req.query.userId);
//         const favorites = db.get('favorites').filter(fav => fav.userId === userId).value();

//         console.log(favorites);

//         console.log(`filter userId: ${req.query.userId} | ${favorites.length}`);

//         exhibitions = exhibitions.map(exhibition => ({
//             ...exhibition,
//             isFavorite: favorites.some(fav => Number(fav.exhibitionId) === Number(exhibition.id)),
//         }));
//     }

//     let exhibition = exhibitions.find(exhibition => Number(exhibition.id) === Number(req.params.exhibitionId));

//     if (req.query._expand === 'organizer' && exhibition) {
//         const organizer = db.get('organizers').find({ id: exhibition.organizerId }).value();
//         exhibition = {
//             ...exhibition,
//             organizer: organizer || null
//         };
//     }

//     if (exhibition) {
//         res.json(exhibition);
//     } else {
//         res.status(404).json({ error: 'Exhibition not found' });
//     }
// });

server.get('/api/exhibitions', paginate, (req, res) => {
	const db = router.db;
	let exhibitions = db.get('exhibitions').value();



	const queryTags = req.query.tags ? req.query.tags.split(',') : [];
	if (queryTags.length > 0) {
			exhibitions = exhibitions.filter(exhibition =>
					exhibition.tags.some(tag => queryTags.includes(tag))
			);
	}
	console.log(`filter tags: ${queryTags} | ${exhibitions.length}`);

	exhibitions.forEach(exhibition => {
		console.log(exhibition.tags);
	})
	console.log("==========")


	if (req.query.regionId) {
			exhibitions = exhibitions.filter(exhibition =>
					exhibition.regionId === Number(req.query.regionId)
			);
	}

	console.log(`filter regionId: ${req.query.regionId} | ${exhibitions.length}`);

	exhibitions.forEach(exhibition => {
		console.log(exhibition.regionId);
	})
	console.log("==========")




	if (req.query.exhibitions_categoriesId) {
			exhibitions = exhibitions.filter(exhibition =>
					exhibition.exhibitions_categoriesId === Number(req.query.exhibitions_categoriesId)
			);
	}

	console.log(`filter exhibitions_categoriesId: ${req.query.exhibitions_categoriesId} | ${exhibitions.length}`);
	exhibitions.forEach(exhibition => {
		console.log(exhibition.exhibitions_categoriesId);
	})

	console.log("==========")

	if (req.query.organizerId) {
			exhibitions = exhibitions.filter(exhibition =>
					exhibition.organizerId === Number(req.query.organizerId)
			);
	}

	console.log(`filter organizerId: ${req.query.organizerId} | ${exhibitions.length}`);
	exhibitions.forEach(exhibition => {
		console.log(exhibition.organizerId);
	})

	console.log("==========")

	if (req.query.featured) {
			exhibitions = exhibitions.filter(exhibition =>
					exhibition.featured === Boolean(req.query.featured)
			);
	}

	console.log(`filter featured: ${req.query.featured} | ${exhibitions.length}`);
	exhibitions.forEach(exhibition => {
		console.log(exhibition.featured);
	});

	console.log("==========")

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

	console.log(`filter date: ${req.query.startDate} - ${req.query.endDate} | ${exhibitions.length}`);
	

	exhibitions.forEach(exhibition => {
		console.log(exhibition.start_date, exhibition.end_date);
	});

	console.log("==========")

    if (req.query.search) {
        const searchQuery = req.query.search; 
        console.log(searchQuery); 
        exhibitions = exhibitions.filter(exhibition =>
            exhibition.title.includes(searchQuery) || 
            exhibition.description.includes(searchQuery) 
        );
    }

	console.log(`filter search: ${req.query.search} | ${exhibitions.length}`);
	exhibitions.forEach(exhibition => {
		console.log(exhibition.title, exhibition.description);
	})

	console.log("==========")

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

	if (req.query.userId) {
        const userId = Number(req.query.userId);
        const favorites = db.get('favorites').filter(fav => fav.userId === userId).value();

		console.log(favorites);

		console.log(`filter userId: ${req.query.userId} | ${favorites.length}`);

        exhibitions = exhibitions.map(exhibition => ({
            ...exhibition,
            isFavorite: favorites.some(fav => Number(fav.exhibitionId) === Number(exhibition.id)),
        }));
    }

	const { startIndex, endIndex } = req.locals.pagination;
	const paginatedExhibitions = exhibitions.slice(startIndex, endIndex);

	if (req.query._expand) {
		console.log("expand");
		console.log(req.query._expand);
		const expandFields = req.query._expand.split(',');
		console.log(expandFields);
	
		if (expandFields.includes('organizer')) {
			const organizers = db.get('organizers').value();
			paginatedExhibitions.forEach(exhibition => {
				exhibition.organizer = organizers.find(org => org.id === exhibition.organizerId) || null;
			});
		}
	
		if (expandFields.includes('region')) {
			const regions = db.get('regions').value();
			paginatedExhibitions.forEach(exhibition => {
				exhibition.region = regions.find(region => region.id === exhibition.regionId) || null;
			});
		}

		if (expandFields.includes('exhibitions_categories')) {
			const exhibitions_categories = db.get('exhibitions_categories').value();
			paginatedExhibitions.forEach(exhibition => {
				exhibition.exhibitions_categories = exhibitions_categories.find(exhibitions_categories => exhibitions_categories.id === exhibition.exhibitions_categoriesId) || null;
			});
		}
	}

	

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
  

		const userResponse = await axios.get(`${API_BASE_URL}/api/users/${userId}`, {
			headers: {
			  'api-key': API_KEY,
			}
		  });
		console.log("userResponse:", userResponse);
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
  

	  const response = await axios.get(`${API_BASE_URL}/api/gotcha_goods`, {
		headers: {
		  'api-key': API_KEY,
		}
	  });
	  let prizes = response.data.filter((prize) => prize.stock > 0);
  
	  if (prizes.length === 0) {
		return res.status(400).json({ message: "所有獎品都已經抽完！" });
	  }
  
	  for (let i = 0; i < drawLimit; i++) {

		const selectedPrize = prizes[Math.floor(Math.random() * prizes.length)];

		await axios.patch(`${API_BASE_URL}/api/gotcha_goods/${selectedPrize.id}`, {
		  stock: selectedPrize.stock - 1,
		},{
			headers: {
			  'api-key': API_KEY,
			}
		  });
  
		prizesWon.push(selectedPrize);
	  }

  const updatedTokens = userTokens - totalTokensNeeded;
  await axios.patch(`${API_BASE_URL}/api/users/${userId}`, {
	e_coin: updatedTokens,
  },{
	headers: {
	  'api-key': API_KEY,
	}
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

  server.post("/api/wish", async (req, res) => {
	const { userId, exhibition_name, description, regionId } = req.body;
  
	try {

	  const userResponse = await axios.get(`${API_BASE_URL}/api/users/${userId}`,{
		headers: {
		  'api-key': API_KEY,
		}
	  });
	  const user = userResponse.data;
  
	  if (!user) {
		return res.status(404).json({ message: "使用者不存在" });
	  }
  

	  const newWish = {
		userId: user.id,  
		exhibition_name,
		description,
		regionId: regionId 
	  };
  

	  const response = await axios.post(`${API_BASE_URL}/api/wishing_fountain`, newWish, {
		headers: {
		  'api-key': API_KEY,
		}
	  });
  
	  res.status(201).json({
		message: "許願成功！",
		wishing_fountain: response.data
	  });
	} catch (error) {
	  console.error("錯誤:", error);
	  res.status(500).json({ message: "許願失敗", error: error.message });
	}
  });

  server.get("/api/votes", async (req, res) => {
	try {
		const response = await axios.get(`${API_BASE_URL}/exhibition_pk?_embed=pk_vote`);
		const exhibitions = response.data;
	
		const exhibitionResults = exhibitions.map(exhibition => ({
		  id: exhibition.id,
		  name: exhibition.name,
		  description: exhibition.description,
		  regionId: exhibition.regionId,
		  tags: exhibition.tags,
		  image: exhibition.image,
		  voteCount: exhibition.pk_vote.length 
		}));
	
		console.log("展覽與投票數統計：", exhibitionResults);

		res.status(200).json({
			message: "取得資料成功！",
			vote_results: exhibitionResults
		  });
	  } catch (error) {
		console.error("獲取展覽資料失敗", error);
	  }
  });

  server.post("/api/pk_vote", async (req, res) => {
	const { userId, exhibition_pkId } = req.body;
  
	try {
	  if (!userId || !exhibition_pkId) {
		return res.status(400).json({ message: "請提供有效的 userId 和 exhibition_pkId" });
	  }
  
	  const pkExhibitionsResponse = await axios.get(`${API_BASE_URL}/exhibition_pk`);
	  const pkExhibitions = pkExhibitionsResponse.data.map((ex) => ex.id);
  
	  if (!pkExhibitions.includes(exhibition_pkId)) {
		return res.status(400).json({ message: "此展覽不屬於當前的 PK 投票" });
	  }

	  const existingVotesResponse = await axios.get(`${API_BASE_URL}/pk_vote?userId=${userId}`);
	  const existingVotes = existingVotesResponse.data;
  
	  const hasVoted = existingVotes.some((vote) => pkExhibitions.includes(vote.exhibition_pkId));
  
	  if (hasVoted) {
		return res.status(400).json({ message: "你已經在這場 PK 投票中投過票，不能再投另一個！" });
	  }
  

	  const newVote = { userId, exhibition_pkId };
	  const response = await axios.post(`${API_BASE_URL}/pk_vote`, newVote, {
		headers: { "api-key": API_KEY },
	  });
  
	  res.status(201).json({
		message: "投票成功！",
		vote: response.data
	  });
  
	} catch (error) {
	  console.error("投票失敗", error);
	  res.status(500).json({ message: "投票失敗", error: error.message });
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