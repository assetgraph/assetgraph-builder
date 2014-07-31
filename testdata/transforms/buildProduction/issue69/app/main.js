require.config({
    baseUrl: 'app',
    enforceDefine: false,
    paths: {
        sockjs: '../vendor/sockjs/sockjs-0.3.4'
    }
});

require(['sockjs'], function (sockjs) {
    alert("got sockjs: " + sockjs);
});
