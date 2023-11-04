/*
 * Copyright (C) 2023 Robin Lamberti.
 *
 * This file is part of google-photos-export-manager.
 *
 * google-photos-export-manager is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * google-photos-export-manager is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with google-photos-export-manager. If not, see <http://www.gnu.org/licenses/>.
 */
import fs from 'fs';
import path from 'path';
import util from 'util';
import * as cliProgress from 'cli-progress';
import yargs from 'yargs/yargs';
import { terminalWidth } from 'yargs';
import { hideBin } from 'yargs/helpers';
import {
  geoDataIsSet,
  addGPSDataToJpegFile,
  addGPSDataToMovie,
} from './geoData';

type AssetEntry = {
  metaPath?: string;
  assetInstances: AssetInstance[];
};

type AssetInstance = {
  edited: boolean;
  path: string;
  album: string;
};

const options = yargs(hideBin(process.argv))
  .wrap(terminalWidth())
  .usage('Usage: -i <input dir> -o <output dir>')
  .option('i', {
    alias: 'input',
    describe: 'The directory containing the unzipped Google Photos archives',
    type: 'string',
    demandOption: true,
  })
  .option('o', {
    alias: 'output',
    describe: 'The directory create the new folder structure',
    type: 'string',
    demandOption: true,
  })
  .option('y', {
    alias: 'yearAlbumPrefix',
    describe:
      'The prefix of the folders in the export containing photos of a certain year',
    type: 'string',
    default: 'Photos from',
  })
  .option('ia', {
    alias: 'ignoreAlbums',
    describe:
      'Assets from that albums will be put in the folder for no album',
    type: 'array',
    default: [] as string[],
  })
  .option('e', {
    alias: 'exportSubPath',
    describe:
      'The relative path that each export archive contain until the albums appear',
    type: 'string',
    default: 'Takeout' + path.sep + 'Google Fotos',
    coerce: (input) =>
      input.split(path.sep).map((p: string) => p.replace(path.sep, '')),
  })
  .option('ep', {
    alias: 'editedPrefix',
    describe: 'The suffix that photos that are edited have',
    type: 'string',
    default: '-bearbeitet',
  })
  .option('m', {
    alias: 'metadataFileName',
    describe: 'The name of the file containing metadata of an album',
    type: 'string',
    default: 'Metadaten.json',
  })
  .parseSync();

const {
  i: inputDir,
  o: outputDir,
  y: yearAlbumPrefix,
  ia: ignoreAlbums,
  ep: editedSuffix,
  e: exportSubPath,
  m: metadataFileName,
} = options;

const albumPaths: Map<string, string[]> = getAlbumPaths();
const assets: Map<string, AssetEntry> = getAssets(albumPaths);
moveAssets(assets);

function getAlbumPaths() {
  console.log('Collecting all albums...');
  const files = fs.readdirSync(inputDir);
  const paths = files
    .map((name) => path.join(inputDir, name, ...exportSubPath))
    .map((folder) =>
      fs.readdirSync(folder).map((element) => path.join(folder, element)),
    )
    .flat()
    .filter((subfolder) => fs.lstatSync(subfolder).isDirectory());

  const albumPaths: Map<string, string[]> = new Map();
  paths.forEach((p) => {
    const key = p.split(path.sep).reverse()[0];
    const value = albumPaths.has(key) ? albumPaths.get(key)! : [];
    value.push(p);
    albumPaths.set(key, value);
  });
  return albumPaths;
}

function getAssets(albumPaths: Map<string, string[]>) {
  console.log('Collecting asset to album assignments...');
  let foundMeta = 0;
  let doubleMeta = 0;
  let editedCount = 0;
  const assets: Map<
    string,
    { metaPath?: string; assetInstances: AssetInstance[] }
  > = new Map();
  Array.from(albumPaths.entries())
    .sort(
      (a, b) => b[0].indexOf(yearAlbumPrefix) - a[0].indexOf(yearAlbumPrefix),
    )
    .forEach(([k, v]) => {
      console.log(`Scraping ${k}...`);
      const files = v
        .map((p) =>
          fs
            .readdirSync(p)
            .filter((e) => e !== metadataFileName)
            .map((e) => path.join(p, e)),
        )
        .flat();

      const extensions = new Set(files.map((f) => f.split('.').reverse()[0]));

      for (const p of files) {
        const fileName = p.split(path.sep).reverse()[0];
        const jsonIndex = fileName.indexOf('.json');
        const isMeta = jsonIndex >= 0;
        let key = fileName;
        for (const ex of Array.from(extensions)) {
          key = key.replace('.' + ex, '');
        }
        const edited = key.indexOf(editedSuffix) >= 0;
        key = key
          // .replace(/\([0-9]\)/, '')
          .replace(editedSuffix, '');
        const value = { path: p, album: k, fileName, edited };
        if (isMeta === true && edited === true) {
          console.log('Edited asset with meta data!');
        }
        if (isMeta) {
          foundMeta++;
        }
        if (edited) {
          editedCount++;
        }
        if (assets.has(key)) {
          const found = assets.get(key)!;
          if (isMeta) {
            if (found.metaPath === undefined) {
              found.metaPath = p;
            } else {
              doubleMeta++;
            }
          } else {
            found.assetInstances.push(value);
          }
        } else {
          if (isMeta) {
            assets.set(key, { metaPath: p, assetInstances: [] });
          } else {
            assets.set(key, { metaPath: undefined, assetInstances: [value] });
          }
        }
      }
    });

  console.log(`Found ${foundMeta} meta files.`);
  console.log(`Found ${doubleMeta} double meta files.`);
  console.log(`${editedCount} assets are edited.`);
  return assets;
}

function moveAssets(assets: Map<string, AssetEntry>) {
  const entries = Array.from(assets.entries());
  console.log(`Copying ${entries.length} assets...`);
  const progressbar = new cliProgress.SingleBar(
    {},
    cliProgress.Presets.shades_classic,
  );
  progressbar.start(entries.length, 0);
  const counter = {
    noMeta: 0,
    noAlbum: 0,
    toManyAlbums: 0,
    geoDataSet: 0,
    writingExifError: 0,
  };
  entries.forEach(([key, { metaPath, assetInstances: instances }]) => {
    let allAlbums = instances.filter((e) => !ignoreAlbums.includes(e.album));
    const hasEdited = allAlbums.some((i) => i.edited);
    if (hasEdited) {
      allAlbums = allAlbums.filter((i) => i.edited);
    }
    const firstAlbum = allAlbums.reverse()[0];

    let suitable = true;
    if (metaPath === undefined) {
      counter.noMeta++;
      console.log(
        'No meta: ',
        util.inspect(instances, {
          showHidden: false,
          depth: null,
          colors: true,
        }),
      );
      suitable = false;
    }
    if (firstAlbum === undefined) {
      counter.noAlbum++;
      console.log(`No album: ${metaPath}`);
      suitable = false;
    }
    if (allAlbums.length > 2) {
      counter.toManyAlbums++;
      console.log(
        `${key} is in ${allAlbums.length} albums: `,
        allAlbums.map((i) => ({ album: i.album, path: i.path })),
      );
      console.log(`Meta: ${metaPath}`);
      suitable = false;
    }
    if (suitable) {
      moveAsset(firstAlbum, metaPath!, counter, key);
    }
    progressbar.increment();
  });
  progressbar.stop();
  console.log(`${counter.geoDataSet} have gps data`);
  console.log(`${counter.writingExifError} have writing exif error`);
  console.log(`${counter.noMeta} have no metadata.`);
  console.log(`${counter.noAlbum} have no album.`);
  console.log(`${counter.toManyAlbums} have to many albums.`);
}

function moveAsset(
  firstAlbum: AssetInstance,
  metaPath: string,
  counter: { geoDataSet: number; writingExifError: number },
  key: string,
) {
  let p = outputDir;
  if (!firstAlbum.album.startsWith(yearAlbumPrefix)) {
    p = path.join(p, 'Album', firstAlbum.album);
  } else {
    p = path.join(p, 'No Album');
  }
  if (!fs.existsSync(p)) {
    fs.mkdirSync(p);
  }
  const fileName = path.basename(firstAlbum.path);
  p = path.join(p, fileName);

  const allowAddingGPS = ['.jpg', '.jpeg', '.png'];
  const meta = JSON.parse(fs.readFileSync(metaPath).toString());
  const extension = path.extname(firstAlbum.path);
  if (geoDataIsSet(meta.geoData)) {
    counter.geoDataSet++;
    if (allowAddingGPS.includes(extension.toLowerCase())) {
      try {
        const imageBinary = fs.readFileSync(firstAlbum.path).toString('binary');
        const newBinary = addGPSDataToJpegFile(imageBinary, meta.geoData);
        let fileBuffer = Buffer.from(newBinary, 'binary');
        fs.writeFileSync(p, fileBuffer);
      } catch (e) {
        console.error(
          `Writing file ${firstAlbum.path} failed\nMeta: ${metaPath}`,
        );
        counter.writingExifError++;
        fs.copyFileSync(firstAlbum.path, p);
      }
    } else {
      fs.copyFileSync(firstAlbum.path, p);
      if (
        extension.toLowerCase() === '.mp4' ||
        extension.toLowerCase() === '.mov'
      ) {
        addGPSDataToMovie(p, meta.geoData);
      } else {
        console.log(
          `Skipping adding gps data for ${key}, because extension is ${extension}`,
        );
      }
    }
  } else {
    fs.copyFileSync(firstAlbum.path, p);
  }
}

function editDates(assets: Map<string, AssetEntry>) {
  const toEdit: { [key: string]: string[] } = JSON.parse(
    fs.readFileSync('./toEdit.json').toString(),
  );
  const toEditFiles = Object.keys(toEdit)
    .map((key) =>
      toEdit[key as keyof typeof toEdit].map((file) => ({ date: key, file })),
    )
    .flat();
  const extensions = new Set(
    toEditFiles.map(({ file }) => file).map((f) => f.split('.').reverse()[0]),
  );
  const output = toEditFiles.map(({ file, date }) => {
    let key = file;
    for (const ex of Array.from(extensions)) {
      key = key.replace('.' + ex, '');
    }
    key = key
      // .replace(/\([0-9]\)/, '')
      .replace(editedSuffix, '');

    const { metaPath } = assets.get(key)!;
    const meta = JSON.parse(fs.readFileSync(metaPath!).toString());
    const photoTakenTime: number = +meta.photoTakenTime?.timestamp;
    const creationTime: number = +meta.creationTime?.timestamp;
    return { file, date, photoTakenTime, creationTime };
  });
  fs.writeFileSync('edit.json', JSON.stringify(output));
}
