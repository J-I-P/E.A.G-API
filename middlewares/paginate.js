// 分頁中間件
function paginate(req, res, next) {
    const page = parseInt(req.query._page, 10) || 1;
    const limit = parseInt(req.query._limit, 10) || 10; // 預設每頁顯示 10 筆
    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + limit;
  
    // 將分頁範圍存到 req.locals，方便後續處理
    req.locals = {
        pagination: {
            page,
            limit,
            startIndex,
            endIndex,
        },
    };
  
    next();
  }

module.exports = paginate;