const config = {
    name: 'healthid-plugin',
    title: 'Health ID Plugin',
    description: 'A plugin for doing Health ID Lookups in the Capture app',
    type: 'app',

    entryPoints: {
        app: './src/App.tsx',
        plugin: './src/Plugin.tsx'
    },
}

module.exports = config
