# PTS Plant GIS by Mr.Thaksin

เว็บสำรวจพรรณไม้ รองรับมือถือ แผนที่ Leaflet และสำรองข้อมูลไปยัง Google Sheets

## โครงสร้าง

- `index.html` และ `pages-config.js` — หน้า GitHub Pages ซึ่งเปิดแอปจาก Apps Script ใน iframe
- `apps-script/Code.gs` — ฝั่งเซิร์ฟเวอร์ อ่าน/บันทึก Google Sheets
- `apps-script/Index.html` — ตัวเว็บแอปหลักที่รันใน Apps Script HTML Service เพื่อใช้ `google.script.run`

GitHub Pages เป็นเว็บสาธารณะแบบ static และไม่สามารถให้ `google.script.run` ทำงานโดยตรงได้ หน้า Pages ของโครงการนี้จึงเป็นตัวเปิดแอป Apps Script; การซิงก์ชีตทำใน Apps Script

## ติดตั้ง Apps Script

1. เปิด Google Sheet เป้าหมาย แล้วเลือก **ส่วนขยาย → Apps Script**
2. วาง `apps-script/Code.gs` ลงในไฟล์สคริปต์
3. กด **+ → HTML** ตั้งชื่อ `Index` แล้ววางเนื้อหาจาก `apps-script/Index.html`
4. บันทึก เลือกฟังก์ชัน `getSnapshot` แล้วกด **เรียกใช้** เพื่ออนุญาตสิทธิ์
5. เลือก **ทำให้ใช้งานได้ → จัดการการทำให้ใช้งานได้** แล้วแก้ไขเว็บแอป
6. เลือกทำงานในนามบัญชีผู้ Deploy และกำหนดผู้เข้าถึงเป็น **ทุกคนที่มีบัญชี Google**
7. เลือก **เวอร์ชันใหม่** แล้ว Deploy

## ตั้งค่า GitHub Pages

1. คัดลอก URL เว็บแอปจาก Apps Script (ลงท้ายด้วย `/exec`)
2. ใส่ URL ใน `pages-config.js` แทน `PASTE_WEB_APP_URL_HERE`
3. เผยแพร่ GitHub Pages จาก branch `main` และโฟลเดอร์ `/ (root)`

ทุกครั้งที่แก้ `apps-script/Code.gs` หรือ `apps-script/Index.html` ต้อง Deploy เวอร์ชันใหม่ใน Apps Script ด้วย ส่วนการแก้ `index.html` หรือ `pages-config.js` ต้อง push ไป GitHub

## การสำรองข้อมูล

ข้อมูลสำรวจ, กลุ่ม, ประวัติการแก้ไข และภาพ JPEG ที่บีบอัดแล้วจะเก็บในชีต `ชีต1`, `กลุ่มสำรวจ`, `ประวัติการเปลี่ยนแปลง` และ `รูปภาพพรรณไม้` ตามลำดับ PIN ครูไม่ถูกส่งไปยังชีต

URL ใน `pages-config.js` เป็นข้อมูลสาธารณะ และสิทธิ์เข้าใช้เว็บแอปกำหนดให้บัญชี Google ทุกบัญชีที่ลงชื่อเข้าใช้เข้าถึงได้ตามตัวเลือกของผู้ใช้ ควรตรวจสิทธิ์การแชร์ชีตให้เหมาะกับข้อมูลของโรงเรียน

