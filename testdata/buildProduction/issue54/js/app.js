require.config({
    paths: {
        backbone: 'vendor/backbone-amd/backbone',
        deepmodel: 'vendor/deep-model'
    }
});

require(['backbone', 'deepmodel'], function (backbone, deepmodel) {
    alert("Yup, got " + backbone + " and " + deepmodel);
});
