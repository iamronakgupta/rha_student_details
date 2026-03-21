# Google Drive profile photo upload

The app can upload profile images to **Google Drive** via your existing Apps Script. The script creates a file in a folder and returns a direct image URL.

## 1. Add the handler in your Apps Script

In your **doPost** (or main request handler), handle `action === 'upload_image'` and call a function like this.

### Folder name

Create or reuse a folder in your Drive, e.g. **"RHA Student Photos"**. The script will create files there.

### Code to add

```javascript
// In your doPost, add a branch like:
var params = request.parameter;
var action = params.action;
if (action === 'upload_image') {
  return handleUploadImage(request);
}

// Add this function (and ensure you have doPost parsing postData.contents for POST body).
function handleUploadImage(request) {
  var result = { success: false };
  try {
    var body = request.postData && request.postData.contents ? request.postData.contents : '{}';
    var data = JSON.parse(body);
    var base64 = data.base64;
    var name = data.name || 'profile.jpg';
    var mimeType = data.mimeType || 'image/jpeg';

    var folderName = 'RHA Student Photos';
    var folder = getOrCreateFolder(folderName);
    var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, name);
    var file = folder.createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    // Direct image URL for <img> tags
    var fileId = file.getId();
    var imageUrl = 'https://drive.google.com/uc?export=view&id=' + fileId;
    result = { success: true, url: imageUrl };
  } catch (e) {
    result.error = e.toString();
  }
  return ContentService.createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreateFolder(name) {
  var iter = DriveApp.getFoldersByName(name);
  if (iter.hasNext()) return iter.next();
  return DriveApp.getRootFolder().createFolder(name);
}
```

### POST body format

The app sends a JSON body (as string, content-type `text/plain;charset=utf-8`):

- `base64`: string (base64-encoded image)
- `name`: string (filename, e.g. `photo.jpg`)
- `mimeType`: string (e.g. `image/jpeg`, `image/png`)

Your script must read the raw POST body. In Apps Script web app:

- For a **doPost(e)** app, use `e.postData.contents` to get the raw body string, then `JSON.parse(e.postData.contents)`.
- If you use a single `doGet`/`doPost` and parse `e.parameter`, note that **POST body** is not in `e.parameter`; you must use `e.postData.contents`.

Example wiring if you use a single entry point:

```javascript
function doPost(e) {
  var body = e.postData ? e.postData.contents : '{}';
  var data = JSON.parse(body);
  var action = data.action || e.parameter.action;
  if (action === 'upload_image') {
    var result = handleUploadImageFromData(data);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  }
  // ... other actions (create, update, etc.)
}

function handleUploadImageFromData(data) {
  var base64 = data.base64;
  var name = data.name || 'profile.jpg';
  var mimeType = data.mimeType || 'image/jpeg';
  var folder = getOrCreateFolder('RHA Student Photos');
  var blob = Utilities.newBlob(Utilities.base64Decode(base64), mimeType, name);
  var file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
  var imageUrl = 'https://drive.google.com/uc?export=view&id=' + file.getId();
  return { success: true, url: imageUrl };
}
```

If your script uses **query parameters** for action (e.g. `?action=upload_image`), keep that and read the body from `e.postData.contents` for the base64 payload.

## 2. Redeploy

After adding the handler, deploy a new version of the web app (or update the deployment) so the same URL is used. The app already calls:

`POST .../exec?action=upload_image`  
with body: `{ "base64": "...", "name": "photo.jpg", "mimeType": "image/jpeg" }`.

## 3. Limits

- **Request size**: Apps Script has a ~50 MB request limit; the app limits images to **5 MB**.
- **Accepted types**: JPEG, PNG, GIF, WebP.

## 4. Optional: delete old photo on new upload

To avoid filling Drive, you can delete a previous file when updating a student’s photo. That requires storing the Drive file ID per student (e.g. in a sheet column) and calling `DriveApp.getFileById(id).setTrashed(true)` before creating the new file. The current flow only **adds** new files.
