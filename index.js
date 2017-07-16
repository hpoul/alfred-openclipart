const alfy = require('alfy');
const fs = require("fs");
const Queue = require('file-queue').Queue;
const child_process = require('child_process');
const path = require('path');
const querystring = require('querystring');

const Shared = require('./lib/Shared.js');


class OpenclipartSearcher {

    constructor(cfg, queue) {
        this.cfg = cfg;
        this.queue = queue;
        this.requireAsyncDownload = false;
    }

    getThumbnailOrQueue(clipart) {
        const thumbnail = this.cfg.thumbnailCachePathForId(clipart.id);
        if (fs.existsSync(thumbnail)) {
            return thumbnail;
        }
        this.requireAsyncDownload = true;
        this.queue.push({action: 'download', args: { url: clipart.svg.png_thumb, to: thumbnail }}, () => {
            // done.
        });
        return './assets/images/matt-icons_image-loading-300px.png';
    }

    fetchCliparts(query) {
        const url = `https://openclipart.org/search/json/?${querystring.stringify({ query: query })}`;
        this.cfg.log('running query.', url);
        return alfy.fetch(url, {maxAge: 60 * 1000}).then(data => {
            const items = data.payload
                .map(x => ({
                    title: x.title,
                    subtitle: x.description,
                    arg: querystring.stringify({action: "openurl", url: x.detail_link}),
                    icon: {path: this.getThumbnailOrQueue(x)},
                    quicklookurl: x.detail_link,
                    variables: {
                        action: "openurl",
                    },
                    mods: {
                        alt: {
                            "valid": true,
                            "arg": querystring.stringify({action: "copysvg", clipart_id: x.id, clipart_url: x.svg.url}),
                            "subtitle": "Copy SVG to clipboard",
                            variables: {
                                action: 'copysvg',
                                clipart_id: x.id,
                                clipart_url: x.svg.url,
                            },
                        },
                        cmd: {
                            "valid": true,
                            "arg": querystring.stringify({action: "revealsvg", clipart_id: x.id, clipart_url: x.svg.url}),
                            "subtitle": "Download SVG and Reveal in Finder",
                        }
                    }
                }));

            const output = {items: items};

            if (this.requireAsyncDownload) {
                output.rerun = .5;
                this.cfg.log('We need to fork child.');

                const out = fs.openSync('./out.log', 'a');
                const err = fs.openSync('./out.log', 'a');

                const child = child_process.fork(__dirname+path.sep+'lib'+path.sep+'QueueWorker.js', [], {
                    detached: true,
                    stdio: [ 'ignore', out, err, 'ipc' ],
                });
                this.cfg.log('forked child.');
                child.disconnect();
                child.unref();
            }
            output.variables = { "action": "blubb" };

            console.log(JSON.stringify(output, null, '\t'));

        }).catch((err) => {
            console.log("Error while downloading/parsing search result.", err);
        });
    }

    fetchClipartsForAlfredQuery() {
        return this.fetchCliparts(process.argv[3]);
    }
}

const _downloadClipart = async (cfg, clipart_id, clipart_url) => {
    cfg.log(`got clipart_id ${clipart_id}.`);
    const path = cfg.svgCachePathForId(clipart_id);
    if (!fs.existsSync()) {
        const url = process.argv[3];
        await cfg.downloadFile(clipart_url, path);
    }
    return path;
};

const runCopyClipart = async (cfg, clipart_id, clipart_url) => {
    const path = _downloadClipart(cfg, clipart_id, clipart_url);
    child_process.execSync(`osascript -e 'set the clipboard to POSIX file "${path}"'`);
};
const revealClipart = async (cfg, clipart_id, clipart_url) => {
    const path = await _downloadClipart(cfg, clipart_id, clipart_url);
    child_process.execSync(
        `osascript -e 'tell application "Finder" to reveal POSIX file "${path}"' -e 'tell application "Finder" to activate'`);
};

const action = process.argv[2];

const runSearch = async (cfg) => {
    const queue = new Queue(cfg.paths.queueDir, () => {
        cfg.log('Setup done.');
        return new OpenclipartSearcher(cfg, queue).fetchClipartsForAlfredQuery().then(() => {
            cfg.log('All done.');
            queue.stop();
        });
    });
};

(async () => {
    const cfg = await Shared.OpenclipartConfig.getConfig();

    if (action === 'search') {
        runSearch(cfg);
    } else if (action === 'copysvg') {
        runCopyClipart(process.env["clipart_id"], process.argv[3]);
    } else if (action === 'runaction') {
        const query = querystring.parse(process.argv[3]);
        if (query['action'] === 'openurl') {
            child_process.execSync(`open "${query['url']}"`)
        } else if (query['action'] === 'copysvg') {
            await runCopyClipart(cfg, query['clipart_id'], query['clipart_url']);
        } else if (query['action'] === 'revealsvg') {
            await revealClipart(cfg, query['clipart_id'], query['clipart_url']);
        }
    }

})().then(() => {

});


