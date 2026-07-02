# PRIMORDIAL AI

> Một dự án mô phỏng trò chơi thám hiểm không gian kết hợp trực quan hóa sinh động **18 thuật toán Trí tuệ nhân tạo (AI)** và Tìm kiếm kinh điển từ giáo trình AI.

Dự án được xây dựng bằng **React + TypeScript + Vite**, mang lại trải nghiệm tương tác trực quan thời gian thực, cho phép người dùng tùy chỉnh bản đồ, theo dõi hoạt động của các thuật toán và phân tích hiệu năng của chúng trực tiếp trên trình duyệt.

---

## Hướng Dẫn Cài Đặt & Khởi Chạy Local

Để chạy dự án trên máy tính của bạn, hãy thực hiện các lệnh sau trong terminal:

```bash
# 1. Cài đặt toàn bộ thư viện cần thiết
npm install

# 2. Khởi chạy máy chủ thử nghiệm (Local Dev Server)
npm run dev

# 3. Chạy các bài kiểm thử thuật toán (Unit Tests)
npm run test

# 4. Biên dịch đóng gói dự án để đưa lên Hosting/Web Server
npm run build
```

Sau khi chạy lệnh `npm run dev`, hãy mở trình duyệt và truy cập: **`http://localhost:5173`** để bắt đầu trải nghiệm thám hiểm!

---

## Các Tính Năng Chính Của Dự Án

* **6 Chương Phiêu Lưu Thử Thách**: Mỗi chương mô phỏng một dạng môi trường đặc trưng (đầm lầy, sương mù, trơn trượt, đối kháng quái vật) tương ứng với các nhóm thuật toán AI khác nhau.
* **Mô Phỏng Trực Quan Thời Gian Thực**: Trực quan hóa trạng thái tìm kiếm theo từng bước (ô đã duyệt, ô biên, đường đi tối ưu, tập trạng thái niềm tin).
* **Bảng Thống Kê Hiệu Năng Thực Tế**: Đánh giá chi tiết hiệu năng thuật toán thông qua các chỉ số:
  * **Steps (Số bước thực thi)**: Tổng số chu kỳ xử lý của thuật toán.
  * **Visited (Số ô đã duyệt)**: Thể hiện độ bao phủ của vùng tìm kiếm.
  * **Max Memory**: Số lượng nút lớn nhất được lưu trong hàng đợi/ngăn xếp tại một thời điểm.
  * **Path Length/Cost**: Chi phí hoặc chiều dài của đường đi tìm được.
* **Bản Đồ Tương Tác Động**: Người chơi có thể tự do dùng chuột để vẽ thêm Tường, Đầm lầy, Quái vật tuần tra, hoặc Mồi nhử để thử thách thuật toán AI.
* **Bộ Điều Khiển Mô Phỏng Linh Hoạt**: Cho phép chạy tự động, tạm dừng, chạy từng bước (Step-by-step), và thay đổi tốc độ mô phỏng nhanh/chậm.
* **Hiệu Ứng Sống Động**: Hệ thống âm thanh, nhạc nền huyền bí và hiệu ứng hoạt họa mượt mà.

---

## Chi Tiết 18 Thuật Toán AI & Cách Áp Dụng Trong Game

Dự án triển khai và áp dụng 18 thuật toán AI được chia đều vào 6 chương chủ đề:

### Chương 1: Uninformed Search (Tìm kiếm mù)
*Môi trường cơ bản, Agent di chuyển tìm đường ngắn nhất trên địa hình không có chi phí đặc biệt.*

1. **BFS (Breadth-First Search - Tìm kiếm theo chiều rộng)**
   * *Cách hoạt động*: Sử dụng hàng đợi FIFO (First-In-First-Out) để duyệt đều ra các hướng xung quanh theo từng lớp sóng đồng tâm.
   * *Áp dụng trong game*: Tìm ra con đường ngắn nhất (số bước đi tối thiểu) từ điểm xuất phát tới Cổng dịch chuyển.
2. **DFS (Depth-First Search - Tìm kiếm theo chiều sâu)**
   * *Cách hoạt động*: Sử dụng ngăn xếp LIFO (Last-In-First-Out) để thám hiểm đi sâu nhất có thể trên một nhánh trước khi quay lui.
   * *Áp dụng trong game*: Agent thám hiểm mò mẫm sâu vào các đường hầm. Kết quả đường đi thường uốn lượn, ngoằn ngoèo và không tối ưu.
3. **IDS (Iterative Deepening Search - Tìm kiếm sâu dần)**
   * *Cách hoạt động*: Lặp lại DFS với giới hạn độ sâu tăng dần ($0, 1, 2, \dots$), kết hợp ưu điểm tiết kiệm bộ nhớ của DFS và tính tối ưu của BFS.
   * *Áp dụng trong game*: Trực quan hóa quá trình quét chiều sâu liên tục mở rộng giới hạn cho đến khi chạm tới Cổng dịch chuyển.

---

### Chương 2: Informed Search (Tìm kiếm có thông tin / Heuristic)
*Môi trường xuất hiện **Đầm lầy Vũ trụ (Cosmic Swamp)**. Đi qua đầm lầy tiêu tốn 3 năng lượng (cost = 3), đi đường thường tốn 1 năng lượng (cost = 1).*

4. **UCS (Uniform Cost Search - Tìm kiếm chi phí đồng nhất / Dijkstra)**
   * *Cách hoạt động*: Sử dụng hàng đợi ưu tiên (Min-Heap) dựa trên hàm chi phí thực tế $g(n)$ để luôn mở rộng nút có tổng chi phí tích lũy thấp nhất.
   * *Áp dụng trong game*: Agent thông minh né tránh đầm lầy và đi đường vòng nếu đường vòng tốn ít năng lượng hơn.
5. **Greedy Best-First Search (Tìm kiếm tham lam tốt nhất)**
   * *Cách hoạt động*: Chỉ sử dụng khoảng cách Manhattan đến đích làm hàm đánh giá $h(n)$ để chọn ô đi tiếp theo gần đích nhất.
   * *Áp dụng trong game*: Agent hướng thẳng về đích một cách "tham lam", bất chấp việc đi xuyên qua đầm lầy gây tốn năng lượng. Chạy rất nhanh nhưng không tối ưu chi phí.
6. **A\* Search (Tìm kiếm A\*)**
   * *Cách hoạt động*: Kết hợp cả hai yếu tố $f(n) = g(n) + h(n)$ để tối ưu hóa cả chi phí thực tế và khoảng cách ước lượng đến đích.
   * *Áp dụng trong game*: Tìm ra con đường tiết kiệm năng lượng nhất (né đầm lầy hợp lý) với số lượng ô cần duyệt ít hơn đáng kể so với UCS nhờ thông tin heuristic dẫn đường.

---

### Chương 3: Local Search (Tìm kiếm cục bộ)
*Agent không lưu giữ lộ trình mà chỉ cố gắng tối ưu hóa vị trí hiện tại dựa trên khoảng cách tới Cổng dịch chuyển và các **Mồi nhử (Baits)** nằm rải rác.*

7. **Hill Climbing (Leo đồi)**
   * *Cách hoạt động*: Liên tục chọn di chuyển sang ô lân cận có giá trị hàm đánh giá tốt nhất (khoảng cách ngắn nhất đến mục tiêu).
   * *Áp dụng trong game*: Agent di chuyển trực diện về phía mồi nhử gần nhất. Rất dễ bị mắc kẹt tại "ngõ cụt" (cực trị cục bộ) nếu xung quanh toàn ô tường hoặc ô xa mục tiêu hơn.
8. **Local Beam Search (Tìm kiếm chùm tia cục bộ)**
   * *Cách hoạt động*: Duy trì song song $k$ trạng thái ($k = 3$ trong game). Tại mỗi bước, sinh ra toàn bộ trạng thái lân cận của cả $k$ tia và chọn lại $k$ trạng thái tốt nhất.
   * *Áp dụng trong game*: Trực quan hóa 3 chấm sáng thám hiểm song song, hỗ trợ lẫn nhau để tăng khả năng thoát khỏi các ngõ cụt và thu thập mồi nhử.
9. **Simulated Annealing (Luyện kim)**
   * *Cách hoạt động*: Chấp nhận đi vào các ô tệ hơn với một xác suất giảm dần theo thời gian (khi nhiệt độ giảm dần).
   * *Áp dụng trong game*: Cho phép Agent đi lùi hoặc đi chệch hướng trong giai đoạn đầu (nhiệt độ cao) để thoát khỏi cực trị cục bộ, sau đó ổn định dần khi tiến sát về đích.

---

### Chương 4: Search under Uncertainty (Tìm kiếm trong môi trường bất định)
*Môi trường không xác định: Agent bị mất định vị toàn cầu, bản đồ bị sương mù che phủ, hoặc địa hình băng trơn trượt gây mất kiểm soát.*

10. **Sensorless Search (Tìm kiếm không cảm biến)**
    * *Cách hoạt động*: Agent bị mù vị trí ban đầu. Thuật toán làm việc trên tập hợp các vị trí khả dĩ (Belief State), tìm chuỗi hành động đưa mọi vị trí khả dĩ hội tụ về đích.
    * *Áp dụng trong game*: Một chấm sáng lớn đại diện tập niềm tin di chuyển đồng bộ theo các lệnh và co cụm lại dần cho đến khi tất cả cùng về đích an toàn.
11. **Online Search (Tìm kiếm trực tuyến)**
    * *Cách hoạt động*: Bản đồ bị bao phủ hoàn toàn bởi sương mù (Fog of War). Agent chỉ nhìn thấy các ô kề cạnh và phải di chuyển thực tế để xây dựng bản đồ cục bộ.
    * *Áp dụng trong game*: Agent dò đường từng bước trong sương mù, cập nhật chướng ngại vật theo thời gian thực và quay lui (backtrack) khi gặp ngõ cụt bằng Online DFS.
12. **And-Or Search (Tìm kiếm And-Or)**
    * *Cách hoạt động*: Môi trường có các ô **Băng trơn trượt**. Khi đi vào, Agent có xác suất bị trượt sang hướng khác. Thuật toán tìm một kế hoạch có điều kiện (conditional plan) dạng cây để ứng phó với mọi trường hợp.
    * *Áp dụng trong game*: Agent di chuyển dựa trên sơ đồ phân nhánh: "Nếu đi lên bị trượt sang trái thì rẽ phải, nếu trượt sang phải thì đi thẳng".

---

### Chương 5: Constraint Satisfaction - CSP (Thỏa mãn ràng buộc)
*Hệ thống an ninh gồm các **Quái vật tuần tra (Patrol Monsters)**. Cần phân bổ vị trí tuần tra và hướng nhìn của chúng sao cho thỏa mãn các ràng buộc an toàn.*

13. **Backtracking Search (Tìm kiếm quay lui cho CSP)**
    * *Cách hoạt động*: Lần lượt gán vị trí cho từng quái vật. Nếu phát hiện quái vật mới vi phạm ràng buộc (tầm nhìn giao nhau, chặn lối đi, đè lên người chơi), thuật toán quay lui để thử vị trí khác.
    * *Áp dụng trong game*: Tìm phương án bố trí đội hình quái vật tuần tra bảo vệ nghiêm ngặt nhưng vẫn đảm bảo có kẽ hở cho người chơi vượt qua.
14. **AC-3 (Arc Consistency 3)**
    * *Cách hoạt động*: Duy trì tính nhất quán trên các cung ràng buộc để liên tục cắt tỉa các vị trí không khả thi khỏi miền giá trị trước và trong khi tìm kiếm.
    * *Áp dụng trong game*: Giúp hệ thống loại bỏ nhanh hàng loạt vị trí lỗi của quái vật, tăng tốc độ tính toán bố cục phòng thủ lên gấp nhiều lần.
15. **Min-Conflicts (Cực tiểu hóa xung đột)**
    * *Cách hoạt động*: Bắt đầu bằng một cấu hình quái vật ngẫu nhiên (chứa nhiều xung đột), sau đó liên tục chọn quái vật đang bị xung đột và đổi sang vị trí mới ít gây xung đột nhất.
    * *Áp dụng trong game*: Quái vật tự động dịch chuyển, điều chỉnh vị trí tuần tra trên lưới cho đến khi toàn bộ hệ thống đạt trạng thái ổn định không xung đột.

---

### Chương 6: Adversarial Search (Tìm kiếm đối kháng)
*Cuộc đối đầu kịch tính theo lượt giữa Người chơi (Max) và **Quái vật thông minh (Smart Monster - Min)**.*

16. **Minimax**
    * *Cách hoạt động*: Xây dựng cây trò chơi đối kháng. Người chơi chọn nước đi tối đa hóa điểm số (Max), quái vật chọn nước đi tối thiểu hóa điểm số của người chơi (Min).
    * *Áp dụng trong game*: Quái vật di động thông minh dự đoán trước các nước đi của người chơi để chủ động di chuyển đến ô cản đường tối ưu nhất.
17. **Alpha-Beta Pruning (Cắt tỉa Alpha-Beta)**
    * *Cách hoạt động*: Cải tiến Minimax bằng cách bỏ qua (tỉa) các nhánh tìm kiếm chắc chắn không ảnh hưởng đến quyết định cuối cùng của cả hai bên.
    * *Áp dụng trong game*: Quái vật tính toán nước cờ cản phá cực nhanh trong vài mili-giây mà vẫn giữ nguyên độ thông minh tối đa.
18. **Expectimax**
    * *Cách hoạt động*: Thay vì giả định đối thủ chơi hoàn hảo, thuật toán tính toán giá trị trung bình (kỳ vọng) dựa trên xác suất đối thủ đi ngẫu nhiên hoặc có sai sót.
    * *Áp dụng trong game*: Agent tối ưu hóa nước đi để lách qua quái vật có hành vi di chuyển ngẫu nhiên hoặc không hoàn toàn tối ưu.

---

## Cấu Trúc Mã Nguồn

* [src/App.tsx](file:///home/nguyenthoai/Project/Song-dai-thanh-huyen-thoai/src/App.tsx): Giao diện người dùng chính (React), quản lý trạng thái mô phỏng, render bản đồ Grid trên Canvas, và tương tác vẽ bản đồ.
* [src/step_fn.ts](file:///home/nguyenthoai/Project/Song-dai-thanh-huyen-thoai/src/step_fn.ts): Trái tim của dự án, chứa toàn bộ logic triển khai của **18 thuật toán AI** dưới dạng hàm Step Generator để mô phỏng từng bước chạy.
* [src/game.ts](file:///home/nguyenthoai/Project/Song-dai-thanh-huyen-thoai/src/game.ts): Định nghĩa các kiểu dữ liệu (`Cell`, `Grid`, `AlgoType`), cấu trúc bản đồ mẫu từ Chương 1 đến Chương 6.
* [src/game.test.ts](file:///home/nguyenthoai/Project/Song-dai-thanh-huyen-thoai/src/game.test.ts): Bộ unit test toàn diện kiểm tra tính đúng đắn của toàn bộ 18 thuật toán.
* [src/audio.ts](file:///home/nguyenthoai/Project/Song-dai-thanh-huyen-thoai/src/audio.ts): Quản lý âm thanh và nhạc nền trong trò chơi.
