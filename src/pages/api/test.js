export default function handler(req, res) {
  res.status(200).json({ 
    status: "Success",
    message: "靈貓系統已上線！",
    time: new Date().toLocaleString()
  });
}