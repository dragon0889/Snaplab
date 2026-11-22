import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { SectionLabel } from "@/components/ui/section-label";
import { Surface } from "@/components/ui/surface";

export const metadata: Metadata = {
  title: "Giấy phép & ghi công · SnapLab",
  description: "Nguồn của các mô hình khối lắp ghép 3D và các nhãn hiệu được nhắc tới trong SnapLab",
};

const LINK = "font-bold underline underline-offset-2 hover:text-ink-soft";

/** Credits required by the licences of the material SnapLab redistributes (see docs/ldraw-pipeline.md). */
export default function LicensesPage() {
  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-4 py-8">
      <Link href="/lessons" className="flex w-fit items-center gap-2 text-sm font-bold text-ink-soft hover:text-ink">
        <ArrowLeft className="h-4 w-4" aria-hidden /> Về danh sách bài
      </Link>

      <header>
        <h1 className="font-display text-4xl font-extrabold leading-tight">Giấy phép &amp; ghi công</h1>
        <p className="mt-2 text-[15px] font-medium text-ink-soft">
          SnapLab dùng một số tài nguyên của cộng đồng. Trang này ghi lại nguồn và giấy phép của chúng.
        </p>
      </header>

      <Surface as="section" className="flex flex-col gap-3 p-6">
        <SectionLabel>Chi tiết khối lắp ghép 3D</SectionLabel>
        <p className="text-[15px]">
          Các mô hình 3D ở bước “Lắp ráp 3D” được dựng từ <strong>LDraw™ Parts Library</strong>, thư viện chi tiết mở do
          cộng đồng <a className={LINK} href="https://www.ldraw.org" target="_blank" rel="noopener noreferrer">LDraw.org</a>{" "}
          đóng góp và duy trì.
        </p>
        <p className="text-[15px]">
          Thư viện được cấp phép theo{" "}
          <a className={LINK} href="https://creativecommons.org/licenses/by/2.0/" target="_blank" rel="noopener noreferrer">
            Creative Commons Attribution 2.0
          </a>{" "}
          (các phiên bản cũ) và{" "}
          <a className={LINK} href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">
            Creative Commons Attribution 4.0
          </a>{" "}
          (các phiên bản mới). Thông tin pháp lý đầy đủ có tại{" "}
          <a className={LINK} href="https://www.ldraw.org/legal-info.html" target="_blank" rel="noopener noreferrer">
            trang pháp lý của LDraw.org
          </a>
          .
        </p>
        <p className="text-[15px] text-ink-soft">
          Thay đổi của SnapLab: gộp các chi tiết cần dùng vào một tệp để chạy trên trình duyệt và chuẩn hoá tên tham chiếu
          về chữ thường. Hình dạng của từng chi tiết được giữ nguyên.
        </p>
      </Surface>

      <Surface as="section" className="flex flex-col gap-3 p-6">
        <SectionLabel>Nhãn hiệu</SectionLabel>
        <p className="text-[15px]">
          LEGO® là nhãn hiệu của LEGO Group. SnapLab là dự án độc lập, không liên kết với, không được tài trợ hay xác nhận
          bởi LEGO Group.
        </p>
        <p className="text-[15px]">LDraw™ là nhãn hiệu thuộc quyền sở hữu và được cấp phép bởi Estate of James Jessiman.</p>
      </Surface>
    </main>
  );
}
