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
import * as piexifts from 'piexif-ts';
import * as ffmetadata from 'ffmetadata';
import util from 'util';

export type GPSData = {
  latitude: number;
  longitude: number;
  altitude: number;
};

// as seen here: https://auth0-com.cdn.ampproject.org/v/s/auth0.com/blog/amp/read-edit-exif-metadata-in-photos-with-javascript
export function addGPSDataToJpegFile(
  imageBinary: string,
  gpsData: GPSData,
): string {
  const exif = piexifts.load(imageBinary);
  const latitudeRef = gpsData.latitude > 0 ? 'N' : 'S';
  const longitudeRef = gpsData.longitude > 0 ? 'E' : 'W';
  // exif tags documented here: https://exiv2.org/tags.html
  exif.GPS = {
    [piexifts.TagValues.GPSIFD.GPSLatitude]:
      piexifts.GPSHelper.degToDmsRational(Math.abs(gpsData.latitude)),
    [piexifts.TagValues.GPSIFD.GPSLongitude]:
      piexifts.GPSHelper.degToDmsRational(Math.abs(gpsData.longitude)),
    [piexifts.TagValues.GPSIFD.GPSAltitude]: findRationalValues(
      Math.abs(gpsData.altitude),
      1000,
    ),
    [piexifts.TagValues.GPSIFD.GPSLatitudeRef]: latitudeRef,
    [piexifts.TagValues.GPSIFD.GPSLongitudeRef]: longitudeRef,
    [piexifts.TagValues.GPSIFD.GPSAltitudeRef]: gpsData.altitude > 0 ? 0 : 1, // 0 = above sea level, 1 = below sea level
  };
  if (
    exif.Exif !== undefined &&
    exif.Exif[piexifts.TagValues.ExifIFD.SceneType] !== undefined
  ) {
    exif.Exif[piexifts.TagValues.ExifIFD.SceneType] = `${
      exif.Exif[piexifts.TagValues.ExifIFD.SceneType]
    }`;
  }
  const exifBinary = piexifts.dump(exif);
  return piexifts.insert(exifBinary, imageBinary);
}

// thanks chatgpt: https://chat.openai.com/share/7688723b-0fae-403b-9095-af92f53f1129
function findRationalValues(
  decimalValue: number,
  maxDenominator: number,
): [number, number] {
  if (maxDenominator <= 0) {
    throw new Error('Maximum denominator must be greater than 0.');
  }

  let denominator = 1;
  let bestNumerator = 0;
  let bestError = Math.abs(decimalValue);

  for (let i = 1; i <= maxDenominator; i++) {
    const roundedNumerator = Math.round(decimalValue * i);
    const error = Math.abs(decimalValue - roundedNumerator / i);

    if (error < bestError) {
      bestNumerator = roundedNumerator;
      denominator = i;
      bestError = error;
    }
  }

  return [bestNumerator, denominator];
}

export function geoDataIsSet(meta: GPSData) {
  const EPS = 0.000001;
  return (
    Math.abs(meta.altitude) > EPS ||
    Math.abs(meta.latitude) > EPS ||
    Math.abs(meta.longitude) > EPS
  );
}

// TODO replace with exiftool
export async function addGPSDataToMovie(path: string, gpsData: GPSData) {
  const read = util.promisify(ffmetadata.read);
  const write = util.promisify(ffmetadata.write);
  const data: any = await read(path);
  const geoString = `${format(gpsData.latitude)}${format(
    gpsData.longitude,
  )}${format(gpsData.altitude)}/`;
  data.location = geoString;
  await write(path, data);
}

function format(x: number) {
  return x.toLocaleString('en-us', {
    maximumFractionDigits: 5,
    minimumFractionDigits: 5,
    signDisplay: 'always',
  });
}
