const fs = require('fs')
const urlParser = require('url')
const request = require('request')
const rp = require('request-promise')

const { promisify } = require('util')
const exec = promisify(require('child_process').exec)

const getLines = file => {
  const contents = fs.readFileSync(file, 'utf8')
  return contents.split('\n')
}

const getAllUris = file => {
  return getLines(file)
    .filter(line => line.includes('resolved'))
    .map(line => line.split('"')[1])
}

const parseFileName = uri => {
  const path = urlParser.parse(uri).path
  return path.substr(path.lastIndexOf('/') + 1)
}

const download = async (fileName, uri) => {
  const options = {
    uri: uri,
    pools: {
      maxSockets: 20,
    },
  }

  return new Promise(resolve => {
    request
      .get(options)
      .on('error', error => {
        console.log('Error: ', error)
      })
      .pipe(fs.createWriteStream('tmp/' + fileName))
      .on('finish', () => {
        resolve()
      })
  })
}

const normalizeBugKeyInPackageJson = async fileName => {
  // relates to https://issues.sonatype.org/browse/NEXUS-16717

  const tempDirectory = fileName + '.dir'

  try {
    await exec(`rm -rf ${tempDirectory}`, { cwd: 'tmp' })

    await exec(`mkdir ${tempDirectory}`, { cwd: 'tmp' })

    await exec(`tar xzf "${fileName}" -C "${tempDirectory}"`, { cwd: `tmp/` })

    var name = fileName.substr(0, fileName.lastIndexOf('-'))
    packagepresent = true;
    var buffer;
    try {
      buffer = fs.readFileSync(
        `tmp/${tempDirectory}/package/package.json`,
        'utf8'
      )
    }
    catch (err) {
      packagepresent = false;
      try {
        buffer = fs.readFileSync(
          `tmp/${tempDirectory}/${name}/package.json`,
          'utf8')

        const json = JSON.parse(buffer)

        if (typeof json.bugs === 'string') {
          json.bugs = {
            url: json.bugs,
          }
          console.log(`fixed ${fileName}`)
        } else {
          return
        }

        const modifiedBuffer = JSON.stringify(json)

        if (packagepresent) {
          fs.writeFileSync(
            `tmp/${tempDirectory}/package/package.json`,
            modifiedBuffer,
            'utf8'
          )
        }
        else {
          fs.writeFileSync(
            `tmp/${tempDirectory}/${name}/package.json`,
            modifiedBuffer,
            'utf8')
        }

        await exec(`tar czf "../${fileName}" "package"`, {
          cwd: `tmp/${tempDirectory}`,
        })
      }
      catch (err) {
        console.log(`Error processing:  ${tempDirectory}/${name}`);
      }
    }


  } catch (err) {
    console.log(err)
  } finally {
    await exec(`rm -rf ${tempDirectory}`, { cwd: 'tmp' })
  }
}

const publish = async fileName => {
  const options = {
    method: 'POST',
    uri: 'http://nexushosturl:8081/repository/npm',
    qs: {
      repository: 'npm',
    },
    headers: {
      'cache-control': 'no-cache',
      'content-type': 'multipart/form-data',
    },
    auth: {
      username: 'admin',
      password: 'foam4all!',
    },
    formData: {
      'npm.asset': {
        value: fs.createReadStream(`tmp/${fileName}`),
        options: { filename: fileName, contentType: null },
      },
    },
    resolveWithFullResponse: true,
  }

  const response = await rp(options)

  if (response.statusCode !== 204) {
    console.log(
      `failed to upload: ${fileName}, statusCode: ${
        response.statusCode
      } statusMessage: ${response.statusMessage} body: ${body}`
    )
  }
}

const yarnPath = 'yarn.lock'
const uris = getAllUris(yarnPath)

console.log(`uploading ${uris.length} artifacts`)

 uris.forEach(async (uri, i) => {
   setTimeout(async () => {
     const fileName = parseFileName(uri)
     await download(fileName, uri)
     await normalizeBugKeyInPackageJson(fileName)
     await publish(fileName)
   }, 200 * i)
 })
