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
import * as piexifts from 'piexif-ts';
import * as moment from 'moment';
import { ExifDateTime, Tags, exiftool } from 'exiftool-vendored';
import { firstDateTime } from 'exiftool-vendored/dist/FirstDateTime';

type FileInfo = { file: string, date: string, photoTakenTime: number, creationTime: number };

(async () => {
  const files: FileInfo[] = JSON.parse(fs.readFileSync('edit.json').toString());
  for (const { file, photoTakenTime, creationTime, date } of files) {
    console.log(`Processing ${date}/${file}...`);
    try {
      const p = path.join(process.cwd(), date, file);
      const ext = path.extname(file).toLowerCase();
      switch (ext) {
        case '.gif':

          break;
        case '.jpg':
        case '.jpeg':
          addDateToExif(p, creationTime, photoTakenTime);
          break;
        case '.png':
        case '.mp4':
          await addExifWithExiftool(photoTakenTime, creationTime, p);
          break;
      }
    } catch (e) {
      console.error(e);
    }
  };
})();

async function addExifWithExiftool(photoTakenTime: number, creationTime: number, p: string) {
  // format seen here: https://www.awaresystems.be/imaging/tiff/tifftags/privateifd/exif/datetimeoriginal.html
  const timestamp = moment.unix(photoTakenTime || creationTime).format('YYYY-MM-DDThh:mm:ss');
  await exiftool.write(p, { AllDates: timestamp }, []);
}

function addDateToExif(p: string, creationTime: number, photoTakenTime: number) {
  const imageBinary = fs.readFileSync(p).toString('binary');
  const exif = piexifts.load(imageBinary);
  if (exif.Exif === undefined) {
    exif.Exif = {};
  }
  exif.Exif[piexifts.TagValues.ExifIFD.DateTimeOriginal] = formatDate(photoTakenTime);
  exif.Exif[piexifts.TagValues.ExifIFD.DateTimeDigitized] = formatDate(creationTime);

  const exifBinary = piexifts.dump(exif);
  const newBinary = piexifts.insert(exifBinary, imageBinary);
  let fileBuffer = Buffer.from(newBinary, 'binary');
  fs.writeFileSync(p, fileBuffer);
}

function formatDate(timestamp: number) {
  const m = moment.unix(timestamp);
  return m.format('YYYY:MM:DD HH:MM:SS');
}

const exifDate = (dt: ExifDateTime | string | undefined) => (dt instanceof ExifDateTime ? dt?.toDate() : null);

export function readDate(p: string) {
  exiftool.read(p).then(tags => {
    const date = exifDate(
      firstDateTime(tags as Tags, [
        'SubSecDateTimeOriginal',
        'DateTimeOriginal',
        'SubSecCreateDate',
        'CreationDate',
        'CreateDate',
        'SubSecMediaCreateDate',
        'MediaCreateDate',
        'DateTimeCreated',
      ]),
    );
    console.log(date);
  });
}
