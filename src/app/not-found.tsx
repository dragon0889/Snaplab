import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto grid min-h-screen max-w-md place-items-center px-4 text-center">
      <div>
        <h1 className="text-2xl font-extrabold">Ôi, không tìm thấy bài học này!</h1>
        <p className="mt-2 text-ink/70">Con thử quay lại danh sách và chọn một bài khác nhé.</p>
        <Link href="/lessons" className="mt-4 inline-block rounded-2xl bg-sky px-5 py-3 font-bold text-white">
          Về danh sách bài học
        </Link>
      </div>
    </div>
  );
}
