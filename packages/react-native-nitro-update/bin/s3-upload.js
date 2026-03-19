/**
 * Minimal S3 uploader using only Node.js built-ins (no AWS SDK needed).
 * Supports AWS Signature V4 for PUT Object requests.
 *
 * SECURITY: Never add real AWS keys to this file, any .md, or comments.
 * Credentials must come only from .env.ota or environment variables.
 */

const crypto = require('crypto')
const https = require('https')
const http = require('http')
const fs = require('fs')
const path = require('path')

function hmac(key, data) {
  return crypto.createHmac('sha256', key).update(data, 'utf8').digest()
}

function sha256Hex(data) {
  return crypto.createHash('sha256').update(data).digest('hex')
}

function getSignatureKey(secretKey, dateStamp, region, service) {
  const kDate = hmac('AWS4' + secretKey, dateStamp)
  const kRegion = hmac(kDate, region)
  const kService = hmac(kRegion, service)
  return hmac(kService, 'aws4_request')
}

function signV4(method, url, headers, body, credentials) {
  const { accessKeyId, secretAccessKey, region } = credentials
  const service = 's3'
  let parsed
  try {
    parsed = new URL(url)
  } catch (e) {
    throw new Error(`Invalid URL: "${url}" (${e.message})`)
  }
  const host = parsed.hostname
  const canonicalUri = parsed.pathname || '/'
  const canonicalQuerystring = parsed.searchParams.toString()

  const now = new Date()
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, '')
  const dateStamp = amzDate.slice(0, 8)

  const payloadHash = (method === 'GET' || method === 'HEAD') ? sha256Hex('') : sha256Hex(body || '')

  headers['host'] = host
  headers['x-amz-date'] = amzDate
  headers['x-amz-content-sha256'] = payloadHash

  const sortedHeaders = Object.keys(headers).sort()
  const canonicalHeaders = sortedHeaders.map((k) => `${k.toLowerCase()}:${headers[k].trim()}\n`).join('')
  const signedHeaders = sortedHeaders.map((k) => k.toLowerCase()).join(';')

  const canonicalRequest = [
    method,
    canonicalUri,
    canonicalQuerystring,
    canonicalHeaders,
    signedHeaders,
    payloadHash,
  ].join('\n')

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256Hex(canonicalRequest),
  ].join('\n')

  const signingKey = getSignatureKey(secretAccessKey, dateStamp, region, service)
  const signature = crypto.createHmac('sha256', signingKey).update(stringToSign, 'utf8').digest('hex')

  headers['authorization'] = `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}, SignedHeaders=${signedHeaders}, Signature=${signature}`

  return headers
}

function headRequest(url, credentials) {
  return new Promise((resolve, reject) => {
    /** @type {Record<string, string>} */
    const headers = {}
    signV4('HEAD', url, headers, '', credentials)

    const parsed = new URL(url)
    const transport = parsed.protocol === 'https:' ? https : http
    const port = parsed.port ? Number(parsed.port) : (parsed.protocol === 'https:' ? 443 : 80)
    const req = transport.request(
      {
        hostname: parsed.hostname,
        port,
        path: parsed.pathname + parsed.search,
        method: 'HEAD',
        headers,
      },
      (res) => {
        res.on('data', () => {})
        res.on('end', () => resolve({ statusCode: res.statusCode }))
      }
    )
    req.on('error', reject)
    req.end()
  })
}

/**
 * Verify that the given credentials can access the S3 bucket (HeadBucket).
 * Resolves if access is OK; rejects with an Error describing the failure.
 *
 * @param {string} bucket - S3 bucket name
 * @param {string} region - AWS region
 * @param {{ accessKeyId: string, secretAccessKey: string }} credentials
 */
async function verifyS3Access(bucket, region, credentials) {
  const url = `https://${bucket}.s3.${region}.amazonaws.com/`
  const { statusCode } = await headRequest(url, { ...credentials, region })

  if (statusCode === 200) {
    return
  }
  if (statusCode === 403) {
    throw new Error('Access denied to bucket. Check that the IAM user has s3:ListBucket and s3:PutObject on this bucket.')
  }
  if (statusCode === 404) {
    throw new Error('Bucket not found. Check the bucket name and region.')
  }
  throw new Error(`S3 returned ${statusCode}. Check credentials and bucket permissions.`)
}

function putObject(url, body, contentType, credentials) {
  return new Promise((resolve, reject) => {
    let parsed
    try {
      parsed = new URL(url)
    } catch (e) {
      reject(new Error(`Invalid URL: "${url}" (${e.message})`))
      return
    }
    const headers = { 'content-type': contentType, 'content-length': String(body.length) }
    signV4('PUT', url, headers, body, credentials)
    const transport = parsed.protocol === 'https:' ? https : http
    const req = transport.request(
      {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'PUT',
        headers,
      },
      (res) => {
        let data = ''
        res.on('data', (chunk) => (data += chunk))
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve({ statusCode: res.statusCode, body: data })
          } else {
            reject(new Error(`S3 PUT failed (${res.statusCode}): ${data}`))
          }
        })
      }
    )
    req.on('error', reject)
    req.write(body)
    req.end()
  })
}

/**
 * Upload a local file to S3.
 *
 * @param {string} filePath - Local file path
 * @param {string} bucket - S3 bucket name
 * @param {string} key - Object key (path in bucket, e.g. "ota/version.txt")
 * @param {string} region - AWS region
 * @param {{ accessKeyId: string, secretAccessKey: string }} credentials
 * @param {string} [contentType] - MIME type (auto-detected if omitted)
 */
async function uploadFile(filePath, bucket, key, region, credentials, contentType) {
  const body = fs.readFileSync(filePath)
  const ext = path.extname(filePath).toLowerCase()
  if (!contentType) {
    const mimeMap = {
      '.txt': 'text/plain',
      '.zip': 'application/zip',
      '.json': 'application/json',
      '.jsbundle': 'application/javascript',
      '.bundle': 'application/javascript',
    }
    contentType = mimeMap[ext] || 'application/octet-stream'
  }

  const url = `https://${bucket}.s3.${region}.amazonaws.com/${key}`
  await putObject(url, body, contentType, { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey, region })
  return url
}

/**
 * Build S3 virtual-hosted URL. Key path segments are encoded for URL safety.
 */
function buildS3Url(bucket, region, key) {
  const b = String(bucket).trim()
  const r = String(region).trim()
  if (!b || !r) {
    throw new Error(`Invalid S3 config: bucket and region are required (bucket=${JSON.stringify(bucket)}, region=${JSON.stringify(region)})`)
  }
  const encodedKey = key.split('/').map(segment => encodeURIComponent(segment)).join('/')
  return `https://${b}.s3.${r}.amazonaws.com/${encodedKey}`
}

/**
 * Verify S3 write access by uploading a small test file (like putObject test.txt "Hello").
 * Use this after the user enters credentials to confirm setup works.
 *
 * @param {string} bucket - S3 bucket name
 * @param {string} prefix - Key prefix (e.g. "ota/")
 * @param {string} region - AWS region
 * @param {{ accessKeyId: string, secretAccessKey: string }} credentials
 */
async function verifyS3Write(bucket, prefix, region, credentials) {
  const b = String(bucket).trim()
  const r = String(region).trim()
  const p = String(prefix || 'ota/').trim().replace(/\/+$/, '') || 'ota'
  if (!b || !r) {
    throw new Error(`Invalid S3 config: bucket and region are required (bucket=${JSON.stringify(bucket)}, region=${JSON.stringify(region)})`)
  }
  const key = (p ? p + '/' : '') + 'setup-test.txt'
  const url = buildS3Url(b, r, key)
  const body = 'Hello'
  const creds = { accessKeyId: credentials.accessKeyId, secretAccessKey: credentials.secretAccessKey, region: r }
  try {
    await putObject(url, body, 'text/plain', creds)
  } catch (err) {
    if (err instanceof Error && err.message.includes('Invalid URL')) {
      throw new Error(`${err.message} — bucket=${b}, region=${r}, key=${key}`)
    }
    throw err
  }
}

module.exports = { uploadFile, verifyS3Access, verifyS3Write }
