require('dotenv').config();

const express = require('express');
const bodyParser = require('body-parser');
const mysql = require('mysql2');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const redis = require('redis');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const http = require('http');
const { Server } = require("socket.io");
const OpenAI = require('openai');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "http://localhost:6678",
        methods: ["GET", "POST"]
    }
});
const port = process.env.PORT || 3000;

const openai = new OpenAI({
    apiKey: process.env.DASHSCOPE_API_KEY,
    baseURL: "https://dashscope.aliyuncs.com/compatible-mode/v1"
});

// Token验证和用户信息解析中间件
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (token == null) return res.status(200).json({ code: 401, success: false, message: '未授权' });

    jwt.verify(token, process.env.JWT_SECRET, (err, user) => {
        if (err) return res.status(200).json({ code: 401, success: false, message: '令牌无效' });
        req.user = user;
        next();
    });
};

// Redis客户端
const redisClient = redis.createClient({
    host: '127.0.0.1',
    port: 6379
});

redisClient.on('error', (err) => {
    console.error('Redis连接失败:', err);
});

redisClient.on('connect', () => {
    console.log('Redis连接成功');
});

// Middleware
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.use(cors({
    origin: 'http://localhost:6678',
    credentials: true,
}));
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // 允许内联脚本
            styleSrc: ["'self'", "'unsafe-inline'"],  // 允许内联样式
            imgSrc: ["'self'", "http://localhost:3000", "data:"], // 允许来自自身和服务器的图片
            connectSrc: ["'self'"],
            fontSrc: ["'self'"],
            mediaSrc: ["'self'"],
            objectSrc: ["'none'"],
            baseUri: ["'self'"],
            formAction: ["'self'"],
            frameAncestors: ["'none'"],
            upgradeInsecureRequests: [],
            blockAllMixedContent: []
        }
    }
}));
app.use(morgan('dev'));

// 确保上传目录存在
const uploadDir = path.join(__dirname, 'public/uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// Multer配置
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, uploadDir);
    },
    filename: function (req, file, cb) {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage: storage });

// Database connection
const db = mysql.createConnection({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
});

db.connect((err) => {
    if (err) {
        console.error('Error connecting to database:', err);
        throw err;
    }
    console.log('Connected to database');
});

let adminUserId = null;
// Find the first admin user on startup
db.query("SELECT id FROM users WHERE role = 'admin' ORDER BY id LIMIT 1", (err, results) => {
    if (err) {
        console.error('Could not find admin user:', err);
        return;
    }
    if (results.length > 0) {
        adminUserId = results[0].id;
        console.log(`Admin user found with ID: ${adminUserId}`);
    } else {
        console.log('No admin user found.');
    }
});

const onlineUsers = new Map(); // K: userId, V: socketId

io.on('connection', (socket) => {
    console.log('a user connected:', socket.id);

    socket.on('user_online', (userId) => {
        console.log(`User ${userId} is online with socket ${socket.id}`);
        onlineUsers.set(userId, socket.id);
        // Optionally, you can broadcast online users list update here
    });

    socket.on('private_message', (data) => {
        const { sender_id, receiver_id, content } = data;
        const query = 'INSERT INTO messages (sender_id, receiver_id, content) VALUES (?, ?, ?)';
        db.query(query, [sender_id, receiver_id, content], (err, result) => {
            if (err) {
                console.error('Error saving message:', err);
                return;
            }
            
            const message = {
                id: result.insertId,
                sender_id,
                receiver_id,
                content,
                created_at: new Date().toISOString(),
                is_read: 0,
            };

            const receiverSocketId = onlineUsers.get(receiver_id);
            if (receiverSocketId) {
                io.to(receiverSocketId).emit('receive_message', message);
            }
            
            // Also send message back to sender to update their own UI
            const senderSocketId = onlineUsers.get(sender_id);
            if (senderSocketId) {
                io.to(senderSocketId).emit('receive_message', message);
            }
        });
    });

    socket.on('disconnect', () => {
        console.log('user disconnected:', socket.id);
        for (let [userId, socketId] of onlineUsers.entries()) {
            if (socketId === socket.id) {
                onlineUsers.delete(userId);
                break;
            }
        }
    });
});

// Routes
app.post('/api/register', (req, res) => {
    if (!req.body) {
        return res.status(200).json({ code: 400, success: false, message: '缺少请求体' });
    }
    const { username, password, nickname } = req.body;
    if (!username || !password || !nickname) {
        return res.status(200).json({ code: 400, success: false, message: '缺少必填字段' });
    }
    const hashedPassword = bcrypt.hashSync(password, 8);
    // 新用户默认角色为 'user'
    const sql = 'INSERT INTO users (username, password, nickname, role) VALUES (?, ?, ?, ?)';
    db.query(sql, [username, hashedPassword, nickname, 'user'], (err, result) => {
        if (err) {
            console.error('Error registering user:', err);
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(200).json({ code: 400, success: false, message: '用户名或邮箱已存在' });
            }
            return res.status(200).json({ code: 500, success: false, message: '注册用户失败' });
        } else {
            res.status(200).json({ code: 200, success: true, message: '用户注册成功' });
        }
    });
});

app.post('/api/login', (req, res) => {
    if (!req.body) {
        return res.status(200).json({ code: 400, success: false, message: '缺少请求体' });
    }
    const { username, password } = req.body;
    if (!username || !password) {
        return res.status(200).json({ code: 400, success: false, message: '缺少必填字段' });
    }
    const sql = 'SELECT * FROM users WHERE username = ?';
    db.query(sql, [username], (err, result) => {
        if (err) {
            return res.status(200).json({ code: 500, success: false, message: '登录失败' });
        } else if (result.length > 0) {
            const user = result[0];
            const passwordMatch = bcrypt.compareSync(password, user.password);
            if (passwordMatch) {
                const token = jwt.sign({ id: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '24h' });
                redisClient.set(token, JSON.stringify(user), 'EX', 3600); // 将用户信息存储到 Redis，设置过期时间为 1 小时
                // 登录成功，返回用户信息和token
                const { password, ...userInfo } = user;
                return res.status(200).json({
                    code: 200,
                    success: true,
                    message: '登录成功',
                    data: {
                        token,
                        id: user.id,
                        username: user.username,
                        role: user.role,
                        nickname: user.nickname,
                        email: user.email,
                        avatar: user.avatar,
                    }
                });
            } else {
                return res.status(200).json({ code: 401, success: false, message: '密码错误' });
            }
        } else {
            return res.status(200).json({ code: 500, success: false, message: '用户名或密码错误' });
        }
    });
});

app.get('/api/activities', (req, res) => {
    redisClient.get('activities', (err, activities) => {
        if (err || !activities) {
            const sql = 'SELECT id, name, description, image_path FROM activities';
            db.query(sql, (err, result) => {
                if (err) {
                    console.error('Error fetching activities:', err);
                    return res.status(200).json({ code: 500, success: false, message: '获取活动失败' });
                }
                redisClient.set('activities', JSON.stringify(result), 'EX', 300); // 将活动列表缓存到 Redis，设置过期时间为 5 分钟
                res.status(200).json({ code: 200, success: true, data: result });
            });
        } else {
            res.status(200).json({ code: 200, success: true, data: JSON.parse(activities) });
        }
    });
});

app.get('/api/payment', (req, res) => {
    const activityId = req.query.activityId;
    if (!activityId) {
        return res.status(200).json({ code: 400, success: false, message: '缺少活动ID' });
    }
    // 直接返回固定二维码图片的路径
    const qrCodeUrl = `/images/qr_code.png`; // 固定的二维码图片路径
    res.send(`
        <html>
        <head>
            <title>支付</title>
        </head>
        <body>
            <h1>请使用微信扫描二维码完成支付</h1>
            <img src="${qrCodeUrl}" alt="QR Code">
        </body>
        </html>
    `);
});

app.get('/api/payment/status', (req, res) => {
    const activityId = req.query.activityId;
    if (!activityId) {
        return res.status(200).json({ code: 400, success: false, message: '缺少活动ID' });
    }
    const sql = 'SELECT status FROM payments WHERE activity_id = ? ORDER BY created_at DESC LIMIT 1';
    db.query(sql, [activityId], (err, result) => {
        if (err) {
            console.error('检查支付状态失败:', err);
            return res.status(200).json({ code: 500, success: false, message: '检查支付状态失败' });
        } else {
            const paymentStatus = result.length > 0 && result[0].status === 'success';
            return res.status(200).json({ code: 200, success: paymentStatus });
        }
    });
});

// 获取角色字典
app.get('/api/role/zdList', (req, res) => {
    const sql = 'SELECT * FROM roles';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching roles:', err);
            return res.status(500).json({ success: false, message: 'Error fetching roles' });
        }
        res.json({ success: true, data: result });
    });
});

// 用户分页列表
app.get('/api/user/page', (req, res) => {
    const { pageNum = 1, pageSize = 10, nickname } = req.query;
    const offset = (pageNum - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (nickname) {
        whereClause += ' AND nickname LIKE ?';
        params.push(`%${nickname}%`);
    }

    const countSql = `SELECT COUNT(*) as total FROM users ${whereClause}`;
    const dataSql = `SELECT * FROM users ${whereClause} LIMIT ? OFFSET ?`;
    params.push(parseInt(pageSize), parseInt(offset));

    db.query(countSql, params.slice(0, params.length - 2), (err, countResult) => {
        if (err) {
            console.error('Error counting users:', err);
            return res.status(200).json({ code: 500, success: false, message: '获取用户列表失败' });
        }
        const total = countResult[0].total;
        db.query(dataSql, params, (err, dataResult) => {
            if (err) {
                console.error('Error fetching users:', err);
                return res.status(200).json({ code: 500, success: false, message: '获取用户列表失败' });
            }
            // 从结果中剔除密码字段
            const users = dataResult.map(user => {
                const { password, ...userWithoutPassword } = user;
                return userWithoutPassword;
            });
            res.status(200).json({ code: 200, success: true, data: { records: users, total } });
        });
    });
});

// 新增/编辑用户
app.post('/api/user/save', (req, res) => {
    const { id, nickname, username, password, email, role, avatar } = req.body;

    if (id) {
        // 更新
        if (password) {
            // 更新密码
            const hashedPassword = bcrypt.hashSync(password, 8);
            const sql = 'UPDATE users SET nickname = ?, username = ?, password = ?, email = ?, role = ?, avatar = ? WHERE id = ?';
            db.query(sql, [nickname, username, hashedPassword, email, role, avatar, id], (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        const field = err.sqlMessage.includes('email') ? '邮箱' : '用户名';
                        return res.status(200).json({ code: 409, success: false, message: `该${field}已被占用` });
                    }
                    console.error('Error updating user:', err);
                    return res.status(200).json({ code: 500, success: false, message: '更新用户失败' });
                }
                res.status(200).json({ code: 200, success: true, message: '用户更新成功' });
            });
        } else {
            // 不更新密码
            const sql = 'UPDATE users SET nickname = ?, username = ?, email = ?, role = ?, avatar = ? WHERE id = ?';
            db.query(sql, [nickname, username, email, role, avatar, id], (err, result) => {
                if (err) {
                    if (err.code === 'ER_DUP_ENTRY') {
                        const field = err.sqlMessage.includes('email') ? '邮箱' : '用户名';
                        return res.status(200).json({ code: 409, success: false, message: `该${field}已被占用` });
                    }
                    console.error('Error updating user:', err);
                    return res.status(200).json({ code: 500, success: false, message: '更新用户失败' });
                }
                res.status(200).json({ code: 200, success: true, message: '用户更新成功' });
            });
        }
    } else {
        // 新增
        const hashedPassword = bcrypt.hashSync(password, 8);
        const sql = 'INSERT INTO users (nickname, username, password, email, role, avatar) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(sql, [nickname, username, hashedPassword, email, role, avatar], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    const field = err.sqlMessage.includes('email') ? '邮箱' : '用户名';
                    return res.status(200).json({ code: 409, success: false, message: `该${field}已被占用` });
                }
                console.error('Error creating user:', err);
                return res.status(200).json({ code: 500, success: false, message: '创建用户失败' });
            }
            res.status(200).json({ code: 200, success: true, message: '用户创建成功' });
        });
    }
});

// 删除用户
app.post('/api/user/delete', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(200).json({ code: 400, success: false, message: '缺少用户ID' });
    }

    const sql = 'DELETE FROM users WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting user:', err);
            return res.status(200).json({ code: 500, success: false, message: '删除用户失败' });
        }
        res.status(200).json({ code: 200, success: true, message: '用户删除成功' });
    });
});

// 获取活动分类列表
app.get('/api/activity/categories', (req, res) => {
    const sql = 'SELECT * FROM activity_categories';
    db.query(sql, (err, result) => {
        if (err) {
            console.error('Error fetching activity categories:', err);
            return res.status(200).json({ code: 500, success: false, message: '获取活动分类失败' });
        }
        res.status(200).json({ code: 200, success: true, data: result });
    });
});

// 活动分页列表
app.get('/api/activity/page', (req, res) => {
    const { pageNum = 1, pageSize = 10, name } = req.query;
    const offset = (pageNum - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (name) {
        whereClause += ' AND a.name LIKE ?';
        params.push(`%${name}%`);
    }

    const countSql = `SELECT COUNT(*) as total FROM activities a ${whereClause}`;
    const dataSql = `
        SELECT a.*, c.name as category_name 
        FROM activities a 
        LEFT JOIN activity_categories c ON a.category_id = c.id 
        ${whereClause} 
        ORDER BY a.id DESC 
        LIMIT ? OFFSET ?
    `;
    params.push(parseInt(pageSize), parseInt(offset));

    db.query(countSql, params.slice(0, params.length - 2), (err, countResult) => {
        if (err) {
            console.error('Error counting activities:', err);
            return res.status(200).json({ code: 500, success: false, message: '获取活动列表失败' });
        }
        const total = countResult[0].total;
        db.query(dataSql, params, (err, dataResult) => {
            if (err) {
                console.error('Error fetching activities:', err);
                return res.status(200).json({ code: 500, success: false, message: '获取活动列表失败' });
            }
            res.status(200).json({ code: 200, success: true, data: { records: dataResult, total } });
        });
    });
});

// 新增/编辑活动
app.post('/api/activity/save', (req, res) => {
    const { id, name, content, startTime, endTime, location, coverImage, status, categoryId, price } = req.body;
    if (id) {
        const sql = 'UPDATE activities SET name = ?, content = ?, start_time = ?, end_time = ?, location = ?, cover_image = ?, status = ?, category_id = ?, price = ? WHERE id = ?';
        db.query(sql, [name, content, startTime, endTime, location, coverImage, status, categoryId, price, id], (err, result) => {
            if (err) {
                console.error('Error updating activity:', err);
                return res.status(200).json({ code: 500, success: false, message: '更新活动失败' });
            }
            res.status(200).json({ code: 200, success: true, message: '活动更新成功' });
        });
    } else {
        const sql = 'INSERT INTO activities (name, content, start_time, end_time, location, cover_image, status, category_id, price) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)';
        db.query(sql, [name, content, startTime, endTime, location, coverImage, status, categoryId, price], (err, result) => {
            if (err) {
                console.error('Error creating activity:', err);
                return res.status(200).json({ code: 500, success: false, message: '创建活动失败' });
            }
            res.status(200).json({ code: 200, success: true, message: '活动创建成功' });
        });
    }
});

// 删除活动
app.post('/api/activity/delete', (req, res) => {
    const { id } = req.body;
    if (!id) {
        return res.status(200).json({ code: 400, success: false, message: '缺少活动ID' });
    }
    const sql = 'DELETE FROM activities WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error deleting activity:', err);
            return res.status(200).json({ code: 500, success: false, message: '删除活动失败' });
        }
        res.status(200).json({ code: 200, success: true, message: '活动删除成功' });
    });
});

// 公共活动列表 - 分页
app.get('/api/public/activities', (req, res) => {
    const { pageNum = 1, pageSize = 10, name, category_id } = req.query;
    const offset = (pageNum - 1) * pageSize;

    let whereClause = "WHERE a.status = 'published'";
    const params = [];

    if (name) {
        whereClause += ' AND a.name LIKE ?';
        params.push(`%${name}%`);
    }
    if (category_id) {
        whereClause += ' AND a.category_id = ?';
        params.push(category_id);
    }
    
    const countSql = `SELECT COUNT(*) as total FROM activities a ${whereClause}`;
    const dataSql = `
        SELECT a.id, a.name, a.start_time, a.end_time, a.location, a.price, a.cover_image, c.name as category_name 
        FROM activities a 
        LEFT JOIN activity_categories c ON a.category_id = c.id 
        ${whereClause} 
        ORDER BY a.start_time DESC 
        LIMIT ? OFFSET ?
    `;
    params.push(parseInt(pageSize), parseInt(offset));

    db.query(countSql, params.slice(0, params.length - 2), (err, countResult) => {
        if (err) {
            console.error('Error counting public activities:', err);
            return res.status(200).json({ code: 500, success: false, message: '获取活动列表失败' });
        }
        const total = countResult[0].total;
        db.query(dataSql, params, (err, dataResult) => {
            if (err) {
                console.error('Error fetching public activities:', err);
                return res.status(200).json({ code: 500, success: false, message: '获取活动列表失败' });
            }
            res.status(200).json({ code: 200, success: true, data: { records: dataResult, total } });
        });
    });
});

// 获取单个活动详情
app.get('/api/public/activities/:id', (req, res) => {
    const { id } = req.params;
    const sql = `
        SELECT a.*, c.name as category_name 
        FROM activities a 
        LEFT JOIN activity_categories c ON a.category_id = c.id 
        WHERE a.id = ? AND a.status = 'published'
    `;
    db.query(sql, [id], (err, result) => {
        if (err) {
            console.error('Error fetching activity details:', err);
            return res.status(200).json({ code: 500, success: false, message: '获取活动详情失败' });
        }
        if (result.length === 0) {
            return res.status(200).json({ code: 404, success: false, message: '活动不存在或未发布' });
        }
        res.status(200).json({ code: 200, success: true, data: result[0] });
    });
});

// 创建报名
app.post('/api/registrations', authenticateToken, (req, res) => {
    const { activity_id } = req.body;
    const user_id = req.user.id;

    if (!activity_id) {
        return res.status(200).json({ code: 400, success: false, message: '缺少活动ID' });
    }

    // 检查是否已报名
    const checkSql = 'SELECT * FROM registrations WHERE user_id = ? AND activity_id = ?';
    db.query(checkSql, [user_id, activity_id], (err, results) => {
        if (err) {
            return res.status(200).json({ code: 500, success: false, message: '查询报名记录失败' });
        }
        if (results.length > 0) {
            return res.status(200).json({ code: 400, success: false, message: '您已报名该活动，请勿重复报名' });
        }

        // 查询活动价格
        const activitySql = 'SELECT price FROM activities WHERE id = ?';
        db.query(activitySql, [activity_id], (err, activityResults) => {
            if (err || activityResults.length === 0) {
                return res.status(200).json({ code: 404, success: false, message: '活动不存在' });
            }
            const activity = activityResults[0];
            const isFree = parseFloat(activity.price) === 0;
            const registrationStatus = isFree ? 'completed' : 'pending_payment';

            // 创建新报名
            const insertSql = 'INSERT INTO registrations (user_id, activity_id, status) VALUES (?, ?, ?)';
            db.query(insertSql, [user_id, activity_id, registrationStatus], (err, result) => {
                if (err) {
                    return res.status(200).json({ code: 500, success: false, message: '报名失败，请稍后重试' });
                }

                const successMessage = isFree ? '报名成功！' : '您已成功报名，请前往"我的报名"页面完成支付。';
                res.status(200).json({
                    code: 200,
                    success: true,
                    message: successMessage,
                    data: {
                        registration_id: result.insertId,
                        status: registrationStatus
                    }
                });
            });
        });
    });
});

// 获取我的报名列表
app.get('/api/my-registrations', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const query = `
        SELECT a.*, r.id as registration_id, r.created_at as registration_date, r.status
        FROM activities a
        JOIN registrations r ON a.id = r.activity_id
        WHERE r.user_id = ?
        ORDER BY r.created_at DESC
    `;
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching my registrations:', err);
            return res.status(200).json({ code: 500, success: false, message: '获取报名列表失败' });
        }
        res.json({ code: 200, success: true, message: '获取成功', data: results });
    });
});

// 检查特定活动的报名状态
app.get('/api/registrations/status', authenticateToken, (req, res) => {
    const { activity_id } = req.query;
    const user_id = req.user.id;

    if (!activity_id) {
        return res.status(200).json({ code: 400, message: '缺少活动ID' });
    }

    const sql = 'SELECT * FROM registrations WHERE user_id = ? AND activity_id = ?';
    db.query(sql, [user_id, activity_id], (err, results) => {
        if (err) {
            return res.status(200).json({ code: 500, message: '查询报名状态失败' });
        }
        const isRegistered = results.length > 0;
        res.status(200).json({ code: 200, data: { isRegistered } });
    });
});

// 模拟支付接口
app.post('/api/payment/initiate', authenticateToken, (req, res) => {
    const { registration_id } = req.body;
    if (!registration_id) {
        return res.status(200).json({ code: 400, message: '缺少报名ID' });
    }
    // 实际项目中，这里会创建支付订单并调用支付网关
    // 此处仅为模拟
    const qrCodeUrl = `/images/qr_code.png`;
    res.status(200).json({ code: 200, data: { qrCodeUrl } });
});

// 模拟确认支付状态
app.post('/api/payment/confirm', authenticateToken, (req, res) => {
    const { registration_id } = req.body;

    // 1. 查找报名信息和活动价格
    const findRegSql = `
        SELECT r.id, r.status, a.price
        FROM registrations r
        JOIN activities a ON r.activity_id = a.id
        WHERE r.id = ? AND r.user_id = ?
    `;
    db.query(findRegSql, [registration_id, req.user.id], (err, results) => {
        if (err || results.length === 0) {
            return res.status(200).json({ code: 404, message: '报名记录不存在' });
        }
        
        const registration = results[0];
        if (registration.status === 'completed') {
            return res.status(200).json({ code: 400, message: '该报名已支付成功' });
        }

        // 2. 更新报名状态和创建支付记录（事务）
        db.beginTransaction(err => {
            if (err) { return res.status(200).json({ code: 500, message: '开启事务失败' }); }
            
            const updateRegSql = "UPDATE registrations SET status = 'completed' WHERE id = ?";
            db.query(updateRegSql, [registration_id], (err, result) => {
                if (err) {
                    return db.rollback(() => res.status(200).json({ code: 500, message: '更新报名状态失败' }));
                }

                const insertPaymentSql = "INSERT INTO payments (registration_id, amount, status, payment_method) VALUES (?, ?, 'success', 'wechat_mock')";
                db.query(insertPaymentSql, [registration_id, registration.price], (err, result) => {
                    if (err) {
                        return db.rollback(() => res.status(200).json({ code: 500, message: '创建支付记录失败' }));
                    }

                    db.commit(err => {
                        if (err) {
                            return db.rollback(() => res.status(200).json({ code: 500, message: '提交事务失败' }));
                        }
                        res.status(200).json({ code: 200, message: '支付成功' });
                    });
                });
            });
        });
    });
});

// 图片上传接口
app.post('/api/upload', upload.single('file'), (req, res) => {
    if (!req.file) {
        return res.status(200).json({ code: 400, message: '请上传文件' });
    }
    const fileUrl = `/uploads/${req.file.filename}`;
    res.status(200).json({ code: 200, message: '上传成功', data: { url: fileUrl } });
});

// 检查活动是否已收藏
app.get('/api/collections/status', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { activity_id } = req.query;
    if (!activity_id) {
        return res.status(200).json({ code: 400,success: false, message: '缺少活动ID' });
    }

    const query = 'SELECT * FROM collections WHERE user_id = ? AND activity_id = ?';
    db.query(query, [userId, activity_id], (err, results) => {
        if (err) {
            console.error('Error checking collection status:', err);
            return res.status(200).json({ code: 500, success: false, message: '查询收藏状态失败' });
        }
        res.json({ code: 200, success: true, data: { isCollected: results.length > 0 } });
    });
});

// 添加收藏
app.post('/api/collections', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { activity_id } = req.body;
    if (!activity_id) {
        return res.status(200).json({ code: 400, success: false, message: '缺少活动ID' });
    }

    const query = 'INSERT INTO collections (user_id, activity_id) VALUES (?, ?)';
    db.query(query, [userId, activity_id], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(200).json({ code: 409, success: false, message: '您已收藏过该活动' });
            }
            console.error('Error adding collection:', err);
            return res.status(200).json({ code: 500, success: false, message: '收藏失败' });
        }
        res.json({ code: 200, success: true, message: '收藏成功', data: { id: result.insertId } });
    });
});

// 取消收藏
app.delete('/api/collections', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { activity_id } = req.body;
    if (!activity_id) {
        return res.status(200).json({ code: 400, success: false, message: '缺少活动ID' });
    }

    const query = 'DELETE FROM collections WHERE user_id = ? AND activity_id = ?';
    db.query(query, [userId, activity_id], (err, result) => {
        if (err) {
            console.error('Error removing collection:', err);
            return res.status(200).json({ code: 500, success: false, message: '取消收藏失败' });
        }
        if (result.affectedRows === 0) {
            return res.status(200).json({ code: 404, success: false, message: '未找到收藏记录' });
        }
        res.json({ code: 200, success: true, message: '取消收藏成功' });
    });
});

// 获取我的收藏列表
app.get('/api/my-collections', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const query = `
        SELECT a.*, c.id as collection_id, c.created_at as collection_date 
        FROM activities a
        JOIN collections c ON a.id = c.activity_id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
    `;
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching my collections:', err);
            return res.status(200).json({ code: 500, success: false, message: '获取收藏列表失败' });
        }
        res.json({ code: 200, success: true, message: '获取成功', data: results });
    });
});

app.get('/api/user/info', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const query = 'SELECT id, username, nickname, email, role, avatar FROM users WHERE id = ?';
    db.query(query, [userId], (err, results) => {
        if (err) {
            console.error('Error fetching user info:', err);
            return res.status(200).json({ code: 500, success: false, message: '获取用户信息失败' });
        }
        res.json({ code: 200, success: true, data: results[0] });
    });
});

app.post('/api/user/update', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { nickname, email, avatar } = req.body;
    const query = 'UPDATE users SET nickname = ?, email = ?, avatar = ? WHERE id = ?';
    db.query(query, [nickname, email, avatar, userId], (err, result) => {
        if (err) {
            console.error('Error updating user info:', err);
            return res.status(200).json({ code: 500, success: false, message: '更新失败' });
        }
        res.json({ code: 200, success: true, message: '更新成功' });
    });
});

app.post('/api/user/change-password', authenticateToken, (req, res) => {
    const userId = req.user.id;
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
        return res.status(200).json({ code: 400, message: '请提供旧密码和新密码' });
    }

    const getUserQuery = 'SELECT * FROM users WHERE id = ?';
    db.query(getUserQuery, [userId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(200).json({ code: 500, message: '用户不存在' });
        }
        const user = results[0];

        bcrypt.compare(oldPassword, user.password, (err, match) => {
            if (err || !match) {
                return res.status(200).json({ code: 401, message: '旧密码不正确' });
            }

            bcrypt.hash(newPassword, 10, (err, hash) => {
                if (err) {
                    return res.status(200).json({ code: 500, message: '密码加密失败' });
                }
                const updatePasswordQuery = 'UPDATE users SET password = ? WHERE id = ?';
                db.query(updatePasswordQuery, [hash, userId], (err, result) => {
                    if (err) {
                        return res.status(200).json({ code: 500, message: '密码更新失败' });
                    }
                    res.json({ code: 200, success: true, message: '密码修改成功' });
                });
            });
        });
    });
});

app.get('/api/users', authenticateToken, (req, res) => {
    const { pageNum = 1, pageSize = 10, nickname } = req.query;
    const offset = (pageNum - 1) * pageSize;

    let whereClause = 'WHERE 1=1';
    const params = [];

    if (nickname) {
        whereClause += ' AND nickname LIKE ?';
        params.push(`%${nickname}%`);
    }

    const countQuery = `SELECT count(*) as total FROM users ${whereClause}`;
    const dataQuery = `SELECT id, username, nickname, email, role, avatar FROM users ${whereClause} ORDER BY created_at DESC LIMIT ?, ?`;
    
    db.query(countQuery, params, (err, countResult) => {
        if (err) {
            console.error('Error counting users:', err);
            return res.status(200).json({ code: 500, message: '查询失败' });
        }
        const total = countResult[0].total;
        params.push(offset, parseInt(pageSize));

        db.query(dataQuery, params, (err, results) => {
            if (err) {
                console.error('Error fetching users:', err);
                return res.status(200).json({ code: 500, message: '查询失败' });
            }
            res.json({ code: 200, data: { records: results, total } });
        });
    });
});

app.post('/api/users', authenticateToken, (req, res) => {
    const { username, password, nickname, email, role, avatar } = req.body;
    bcrypt.hash(password, 10, (err, hash) => {
        if (err) {
            return res.status(200).json({ code: 500, message: '密码加密失败' });
        }
        const query = 'INSERT INTO users (username, password, nickname, email, role, avatar) VALUES (?, ?, ?, ?, ?, ?)';
        db.query(query, [username, hash, nickname, email, role, avatar], (err, result) => {
            if (err) {
                 if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(200).json({ code: 409, message: '用户名已存在' });
                }
                console.error('Error creating user:', err);
                return res.status(200).json({ code: 500, message: '创建失败' });
            }
            res.json({ code: 200, success: true, message: '创建成功' });
        });
    });
});

app.put('/api/users/:id', authenticateToken, (req, res) => {
    const userId = req.params.id;
    const { nickname, email, role, password, avatar } = req.body;

    let query;
    let params;

    if (password) {
        bcrypt.hash(password, 10, (err, hash) => {
            if (err) {
                return res.status(200).json({ code: 500, message: '密码加密失败' });
            }
            query = 'UPDATE users SET nickname = ?, email = ?, role = ?, password = ?, avatar = ? WHERE id = ?';
            params = [nickname, email, role, hash, avatar, userId];
            executeUpdate(query, params, res);
        });
    } else {
        query = 'UPDATE users SET nickname = ?, email = ?, role = ?, avatar = ? WHERE id = ?';
        params = [nickname, email, role, avatar, userId];
        executeUpdate(query, params, res);
    }
});

function executeUpdate(query, params, res) {
    db.query(query, params, (err, result) => {
        if (err) {
            console.error('Error updating user:', err);
            return res.status(200).json({ code: 500, message: '更新失败' });
        }
        res.json({ code: 200, success: true, message: '更新成功' });
    });
}


// Admin: Delete a user
app.delete('/api/users/:id', authenticateToken, (req, res) => {
    const userId = req.params.id;
    if (!userId) {
        return res.status(200).json({ code: 400, success: false, message: '缺少用户ID' });
    }

    const sql = 'DELETE FROM users WHERE id = ?';
    db.query(sql, [userId], (err, result) => {
        if (err) {
            console.error('Error deleting user:', err);
            return res.status(200).json({ code: 500, success: false, message: '删除用户失败' });
        }
        res.status(200).json({ code: 200, success: true, message: '用户删除成功' });
    });
});

// 获取活动的评论列表
app.get('/api/activities/:id/comments', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT c.id, c.content, c.created_at, u.nickname, u.avatar 
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.activity_id = ?
        ORDER BY c.created_at DESC
    `;
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error fetching comments:', err);
            return res.status(200).json({ code: 500, message: '获取评论失败' });
        }
        res.json({ code: 200, success: true, data: results });
    });
});

// 发表新评论
app.post('/api/activities/:id/comments', authenticateToken, (req, res) => {
    const { id: activity_id } = req.params;
    const { content } = req.body;
    const user_id = req.user.id;

    if (!content) {
        return res.status(200).json({ code: 400, message: '评论内容不能为空' });
    }

    const query = 'INSERT INTO comments (activity_id, user_id, content) VALUES (?, ?, ?)';
    db.query(query, [activity_id, user_id, content], (err, result) => {
        if (err) {
            console.error('Error creating comment:', err);
            return res.status(200).json({ code: 500, message: '发表评论失败' });
        }
        res.json({ code: 200, success: true, message: '评论成功', data: { id: result.insertId } });
    });
});

// 获取活动的评分数据
app.get('/api/activities/:id/ratings', (req, res) => {
    const { id } = req.params;
    const query = `
        SELECT 
            r.id,
            r.rating,
            r.content,
            r.created_at,
            u.nickname,
            u.avatar,
            (SELECT AVG(rating) FROM ratings WHERE activity_id = r.activity_id) as average_rating,
            (SELECT COUNT(*) FROM ratings WHERE activity_id = r.activity_id) as total_ratings
        FROM ratings r
        JOIN users u ON r.user_id = u.id
        WHERE r.activity_id = ?
        ORDER BY r.created_at DESC
    `;
    db.query(query, [id], (err, results) => {
        if (err) {
            console.error('Error fetching ratings:', err);
            return res.status(200).json({ code: 500, message: '获取评分失败' });
        }
        
        const totalRatings = results.length > 0 ? results[0].total_ratings : 0;
        const averageRating = results.length > 0 ? parseFloat(results[0].average_rating).toFixed(1) : 0;
        
        const ratingsList = results.map(r => ({
            id: r.id,
            rating: r.rating,
            content: r.content,
            created_at: r.created_at,
            nickname: r.nickname,
            avatar: r.avatar
        }));

        res.json({ code: 200, success: true, data: {
            ratings: ratingsList,
            totalRatings: totalRatings,
            averageRating: averageRating
        } });
    });
});

// 提交评分
app.post('/api/activities/:id/ratings', authenticateToken, (req, res) => {
    const { id: activity_id } = req.params;
    const { rating, content } = req.body;
    const user_id = req.user.id;

    if (!rating || rating < 1 || rating > 5) {
        return res.status(200).json({ code: 400, message: '评分必须在1到5之间' });
    }

    const query = 'INSERT INTO ratings (activity_id, user_id, rating, content) VALUES (?, ?, ?, ?)';
    db.query(query, [activity_id, user_id, rating, content], (err, result) => {
        if (err) {
            if (err.code === 'ER_DUP_ENTRY') {
                return res.status(200).json({ code: 409, message: '您已经对此活动评过分了' });
            }
            console.error('Error submitting rating:', err);
            return res.status(200).json({ code: 500, message: '评分失败' });
        }
        res.json({ code: 200, success: true, message: '评分成功', data: { id: result.insertId } });
    });
});


app.get('/api/chat/admin', authenticateToken, (req, res) => {
    if (!adminUserId) {
        return res.status(200).json({ code: 404, message: '暂无在线客服' });
    }
    db.query("SELECT id, nickname, avatar FROM users WHERE id = ?", [adminUserId], (err, results) => {
        if (err || results.length === 0) {
            return res.status(200).json({ code: 500, message: '获取客服信息失败' });
        }
        res.json({ code: 200, success: true, data: results[0] });
    });
});

app.get('/api/chat/users', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(200).json({ code: 403, message: '无权访问' });
    }
    const adminId = req.user.id;
    const query = `
        SELECT u.id, u.nickname, u.avatar, m.content as last_message, m.created_at
        FROM users u
        JOIN (
            SELECT 
                IF(sender_id = ?, receiver_id, sender_id) as user_id, 
                MAX(id) as max_id
            FROM messages
            WHERE sender_id = ? OR receiver_id = ?
            GROUP BY user_id
        ) mu ON u.id = mu.user_id
        JOIN messages m ON mu.max_id = m.id
        ORDER BY m.created_at DESC;
    `;
    db.query(query, [adminId, adminId, adminId], (err, results) => {
        if (err) {
            console.error('Error fetching chat users:', err);
            return res.status(200).json({ code: 500, message: '获取用户列表失败' });
        }
        res.json({ code: 200, success: true, data: results });
    });
});

app.get('/api/chat/history/:userId', authenticateToken, (req, res) => {
    const otherUserId = parseInt(req.params.userId, 10);
    const currentUserId = req.user.id;
    
    const query = `
        SELECT * FROM messages 
        WHERE (sender_id = ? AND receiver_id = ?) OR (sender_id = ? AND receiver_id = ?)
        ORDER BY created_at ASC
    `;
    db.query(query, [currentUserId, otherUserId, otherUserId, currentUserId], (err, results) => {
        if (err) {
            console.error('Error fetching chat history:', err);
            return res.status(200).json({ code: 500, message: '获取聊天记录失败' });
        }
        res.json({ code: 200, success: true, data: results });
    });
});

app.post('/api/activities/analyze', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(200).json({ code: 403, message: '无权访问' });
  }

  const { activity, prompt } = req.body;

  if (!activity || !prompt) {
    return res.status(200).json({ code: 400, message: '缺少必要的参数' });
  }
  
  const systemPrompt = `
    你是一位顶级的活动策划专家。
    你的任务是根据用户提供的现有活动JSON数据和优化要求，对活动策划方案进行优化。

    你的回复必须是一个格式完整的JSON对象，并且只包含JSON内容，不要有任何其他多余的文字或解释。

    这个JSON对象必须包含两个顶级键: "reasoning" 和 "activityData"。
    1. "reasoning" (string): 对你的修改思路和优化建议进行详细的文字说明。
    2. "activityData" (object): 优化后的活动数据。这个对象内部**只能**包含以下几个键: name (string), content (string, HTML格式), location (string), price (number), start_time (string), end_time (string)。

    在生成 "activityData" 时，请严格遵守以下规则：
    - **不要添加**任何额外的字段。
    - start_time 和 end_time 必须是 'YYYY-MM-DD HH:mm:ss' 格式的字符串。
    - price 必须是数字类型。
    - 确保 "activityData" 对象本身是一个纯净的数据对象。

    确保整个输出是格式绝对正确的JSON。
  `;

  try {
    const completion = await openai.chat.completions.create({
        model: "qwen-plus",
        messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: `这是现有的活动信息：\n${JSON.stringify(activity)}\n\n这是我的优化要求：\n${prompt}` }
        ],
        response_format: { type: "json_object" },
    });
    
    const content = completion.choices[0].message.content;

    try {
      const parsedData = JSON.parse(content);

      if (!parsedData.reasoning || !parsedData.activityData) {
        throw new Error("AI返回的数据缺少必要的 'reasoning' 或 'activityData' 字段。");
      }
      
      const allowedKeys = ['name', 'content', 'location', 'price', 'start_time', 'end_time'];
      const sanitizedActivityData = Object.keys(parsedData.activityData)
        .filter(key => allowedKeys.includes(key))
        .reduce((obj, key) => {
          obj[key] = parsedData.activityData[key];
          return obj;
        }, {});

      const finalResponse = {
        reasoning: parsedData.reasoning,
        activityData: sanitizedActivityData
      };

      res.json({ code: 200, success: true, data: finalResponse });
    } catch(e) {
      console.error('Error parsing AI response JSON:', e.message);
      console.error('Original AI response string:', content);
      return res.status(200).json({ code: 500, message: `AI返回的数据格式错误: ${e.message}` });
    }

  } catch (error) {
    console.error('Error calling OpenAI API:', error);
    res.status(200).json({ code: 500, message: '调用AI服务失败' });
  }
});

app.get('/api/dashboard/stats', authenticateToken, async (req, res) => {
  if (req.user.role !== 'admin') {
    return res.status(200).json({ code: 403, message: '无权访问' });
  }

  try {
    const query = (sql, params = []) => {
      return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
          if (err) return reject(err);
          resolve(results);
        });
      });
    };

    const [
      totalUsers,
      totalActivities,
      totalRegistrations,
      totalRevenue,
      userRoles,
      activityStatus,
      popularActivities,
      dailyRegistrations
    ] = await Promise.all([
      query("SELECT COUNT(*) as count FROM users"),
      query("SELECT COUNT(*) as count FROM activities"),
      query("SELECT COUNT(*) as count FROM registrations"),
      query("SELECT SUM(a.price) as total FROM registrations r JOIN activities a ON r.activity_id = a.id"),
      query("SELECT role, COUNT(*) as count FROM users GROUP BY role"),
      query("SELECT status, COUNT(*) as count FROM activities GROUP BY status"),
      query("SELECT a.name, COUNT(r.id) as count FROM registrations r JOIN activities a ON r.activity_id = a.id GROUP BY a.id ORDER BY count DESC LIMIT 5"),
      query("SELECT DATE_FORMAT(created_at, '%Y-%m-%d') as date, COUNT(*) as count FROM registrations WHERE created_at >= DATE_SUB(NOW(), INTERVAL 30 DAY) GROUP BY date ORDER BY date ASC")
    ]);
    
    const statusMap = {
      'draft': '草稿',
      'published': '已发布'
    };

    const stats = {
      totalUsers: totalUsers[0].count,
      totalActivities: totalActivities[0].count,
      totalRegistrations: totalRegistrations[0].count,
      totalRevenue: totalRevenue[0].total || 0,
      userRoles: userRoles.map(item => ({ type: item.role, value: item.count })),
      activityStatus: activityStatus.map(item => ({ type: statusMap[item.status] || item.status, value: item.count })),
      popularActivities: popularActivities.map(item => ({ name: item.name, count: item.count })),
      dailyRegistrations: dailyRegistrations.map(item => ({ date: item.date, count: item.count }))
    };

    res.json({ code: 200, success: true, data: stats });

  } catch (error) {
    console.error('Error fetching dashboard stats:', error);
    res.status(200).json({ code: 500, message: '获取统计数据失败' });
  }
});

app.post('/api/activity-categories/save', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: '无权访问' });
    }
    const { id, name } = req.body;
    if (!name) {
        return res.status(200).json({ code: 400, success: false, message: '分类名称不能为空' });
    }
    if (id) {
        const sql = 'UPDATE activity_categories SET name = ? WHERE id = ?';
        db.query(sql, [name, id], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(200).json({ code: 409, success: false, message: '该分类名称已存在' });
                }
                console.error('Error updating category:', err);
                return res.status(200).json({ code: 500, success: false, message: '更新分类失败' });
            }
            res.json({ code: 200, success: true, message: '分类更新成功' });
        });
    } else {
        const sql = 'INSERT INTO activity_categories (name) VALUES (?)';
        db.query(sql, [name], (err, result) => {
            if (err) {
                if (err.code === 'ER_DUP_ENTRY') {
                    return res.status(200).json({ code: 409, success: false, message: '该分类名称已存在' });
                }
                console.error('Error creating category:', err);
                return res.status(200).json({ code: 500, success: false, message: '创建分类失败' });
            }
            res.json({ code: 200, success: true, message: '分类创建成功' });
        });
    }
});

app.post('/api/activity-categories/delete', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: '无权访问' });
    }
    const { id } = req.body;
    if (!id) {
        return res.status(200).json({ code: 400, success: false, message: '缺少分类ID' });
    }
    const sql = 'DELETE FROM activity_categories WHERE id = ?';
    db.query(sql, [id], (err, result) => {
        if (err) {
            if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                 return res.status(200).json({ code: 409, success: false, message: '无法删除，该分类下已有活动' });
            }
            console.error('Error deleting category:', err);
            return res.status(200).json({ code: 500, success: false, message: '删除分类失败' });
        }
        res.json({ code: 200, success: true, message: '分类删除成功' });
    });
});

app.get('/api/registrations/page', authenticateToken, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ message: '无权访问' });
    }

    const { pageNum = 1, pageSize = 10, activityName, userNickname } = req.query;
    const offset = (pageNum - 1) * pageSize;

    let whereClauses = [];
    const params = [];

    if (activityName) {
        whereClauses.push('a.name LIKE ?');
        params.push(`%${activityName}%`);
    }
    if (userNickname) {
        whereClauses.push('u.nickname LIKE ?');
        params.push(`%${userNickname}%`);
    }

    const whereSql = whereClauses.length > 0 ? `WHERE ${whereClauses.join(' AND ')}` : '';

    const countParams = [...params];
    const dataParams = [...params, parseInt(pageSize), parseInt(offset)];

    const countSql = `
        SELECT COUNT(*) as total 
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        JOIN activities a ON r.activity_id = a.id
        ${whereSql}
    `;

    const dataSql = `
        SELECT 
            r.id, r.created_at,
            u.nickname as user_nickname, u.email as user_email,
            a.name as activity_name, a.price as activity_price
        FROM registrations r
        JOIN users u ON r.user_id = u.id
        JOIN activities a ON r.activity_id = a.id
        ${whereSql}
        ORDER BY r.created_at DESC
        LIMIT ? OFFSET ?
    `;

    db.query(countSql, countParams, (err, countResult) => {
        if (err) {
            console.error('Error counting registrations:', err);
            return res.status(200).json({ code: 500, success: false, message: '获取报名列表失败' });
        }
        const total = countResult[0].total;
        db.query(dataSql, dataParams, (err, dataResult) => {
            if (err) {
                console.error('Error fetching registrations:', err);
                return res.status(200).json({ code: 500, success: false, message: '获取报名列表失败' });
            }
            res.json({ code: 200, success: true, data: { records: dataResult, total } });
        });
    });
});

server.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
});