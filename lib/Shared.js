const envPaths = require('env-paths');
const readPkgUp = require('read-pkg-up');
const fse = require('fs-extra');


class OpenclipartConfig {

    constructor(paths) {
        this.paths = paths;
    }

    static async getConfig() {
        const pkg = readPkgUp.sync().pkg;

        //noinspection JSUnresolvedVariable
        const cacheDir = envPaths(pkg.name).cache;
        const paths = {
            cacheDir: cacheDir,
            queueDir: cacheDir + '/queue',
            thumbnailDir: cacheDir + '/thumbnails',
        };

        await fse.ensureDir(paths.cacheDir);
        await fse.ensureDir(paths.queueDir);
        await fse.ensureDir(paths.thumbnailDir);

        return new OpenclipartConfig(paths);
    }

    log() {
        // console.log.apply(console.log, arguments);
    }
}

module.exports = { OpenclipartConfig: OpenclipartConfig, };
