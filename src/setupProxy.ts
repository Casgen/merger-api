const {createProxyMiddleware} = require('http-proxy-middleware');

module.exports = (app: { use: (arg0: string, arg1: string) => void; }): void => {
    app.use('/auth/**', createProxyMiddleware({
        target: `http://localhost:${process.env.PORT}`
    }))
}
