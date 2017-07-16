const envPaths = require('env-paths');
const readPkgUp = require('read-pkg-up');
const fse = require('fs-extra');
const fs = require("fs");
const request = require('request');


class OpenclipartConfig {

    constructor(paths) {
        this.paths = paths;
    }

    thumbnailCachePathForId(clipart_id) {
        return this.paths.thumbnailDir + '/' + clipart_id + '.png';
    };

    svgCachePathForId(clipart_id) {
        return this.paths.thumbnailDir + '/' + clipart_id + '.svg';
    };


    downloadFile(url, savePath) {
        const tmpto = savePath + '.' + new Date().getTime() + '.tmp';
        console.log(`we need to download ${url} to ${savePath} (via ${tmpto})`);
        return new Promise((resolve, reject) => {
            request({
                url: url,
            }, (error, message, response) => {
                if (error) {
                    console.log('error downloading file', error);
                    reject(error);
                    return;
                }
                console.log('Successfully downloaded file.');
                fs.renameSync(tmpto, savePath);
                resolve(response);
            }).pipe(fs.createWriteStream(tmpto));
        });
    };


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
        //console.log.apply(console.log, arguments);
    }
}

module.exports = { OpenclipartConfig: OpenclipartConfig, };
